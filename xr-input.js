// Quest 3 Controllers + Hand Tracking (ray + subtiele hand-aanwezigheid) + Desktop muis-interactie
import * as THREE from 'three';

function createHandGlow() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe4b8, transparent: true, opacity: 0.78 })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 14, 10),
    new THREE.MeshBasicMaterial({
      color: 0x6ae6d6,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  // 10 kleine zwevende glinster-deeltjes rond de hand
  const count = 10;
  const pos = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xffe5b0,
      size: 0.025,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  group.add(core, halo, dust);
  group.userData = { core, halo, dust, dustPos: pos, count };
  group.visible = false;
  return group;
}

export class XRInputManager {
  constructor(renderer, scene, camera, handlers) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.handlers = handlers;

    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.tempVec = new THREE.Vector3();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // 2 XR controllers + 2 XR hands
    this.controllers = [];
    this.handGlows = [];

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const hand = renderer.xr.getHand(i);

      // Subtiele laserstraal voor Build / Ready / Done
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -4.5)
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x7be3d0,
        transparent: true,
        opacity: 0.65
      });
      const line = new THREE.Line(lineGeo, lineMat);
      controller.add(line);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      dot.visible = false;
      scene.add(dot);

      const glow = createHandGlow();
      scene.add(glow);

      scene.add(controller, hand);

      const entry = {
        index: i,
        controller,
        hand,
        line,
        dot,
        glow,
        connected: false,
        selecting: false,
        draggingObj: null,
        dragY: 0,
        source: null
      };

      controller.addEventListener('connected', ev => {
        entry.connected = true;
        entry.source = ev.data;
      });
      controller.addEventListener('disconnected', () => {
        entry.connected = false;
        entry.source = null;
        entry.selecting = false;
        entry.draggingObj = null;
        dot.visible = false;
        glow.visible = false;
      });
      controller.addEventListener('selectstart', () => this._onXRSelectStart(entry));
      controller.addEventListener('selectend', () => this._onXRSelectEnd(entry));
      controller.addEventListener('squeezestart', () => {
        if (this.handlers.onRecenter) {
          this.handlers.onRecenter();
          this._haptic(entry, 0.2, 30);
        }
      });

      this.controllers.push(entry);
      this.handGlows.push(glow);
    }

    // Desktop state
    this.desktop = {
      yaw: 0,
      pitch: -0.05,
      looking: false,
      pointerDown: false,
      draggingObj: null,
      dragY: 0,
      lastX: 0,
      lastY: 0,
      ndc: new THREE.Vector2(99, 99),
      hasPointer: false
    };

    this._bindDesktopEvents(renderer.domElement);
  }

  _bindDesktopEvents(dom) {
    const getNDC = (ev) => {
      const rect = dom.getBoundingClientRect();
      this.desktop.ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.desktop.ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.desktop.hasPointer = true;
    };

    dom.addEventListener('pointerdown', (ev) => {
      if (this.renderer.xr.isPresenting) return;
      getNDC(ev);
      this.desktop.pointerDown = true;
      this.desktop.lastX = ev.clientX;
      this.desktop.lastY = ev.clientY;

      this.raycaster.setFromCamera(this.desktop.ndc, this.camera);
      // 1. Check 3D panel / pill first
      const panelHits = this.raycaster.intersectObjects(this.handlers.getPanelMeshes(), false);
      if (panelHits.length > 0) {
        const hit = panelHits[0];
        const isPill = !!hit.object.userData.isPill;
        if (this.handlers.onPanelDown(hit.uv, isPill)) {
          return;
        }
      }

      // 2. Check 3D props / sound orbs
      if (this.handlers.isBuildMode()) {
        const objHits = this.raycaster.intersectObjects(this.handlers.getObjectMeshes(), false);
        if (objHits.length > 0) {
          const ud = objHits[0].object.userData;
          this.desktop.draggingObj = { id: ud.id, kind: ud.kind };
          this.desktop.dragY = this.handlers.getObjectY(ud.id, ud.kind);
          this.handlers.onObjectSelect(ud.id, ud.kind);
          return;
        }
      }

      // 3. Anders: sleep om rond te kijken
      this.desktop.looking = true;
    });

    window.addEventListener('pointermove', (ev) => {
      if (this.renderer.xr.isPresenting) return;
      getNDC(ev);

      if (this.desktop.looking) {
        const dx = ev.clientX - this.desktop.lastX;
        const dy = ev.clientY - this.desktop.lastY;
        this.desktop.lastX = ev.clientX;
        this.desktop.lastY = ev.clientY;
        this.desktop.yaw -= dx * 0.0042;
        this.desktop.pitch = Math.max(-1.15, Math.min(1.15, this.desktop.pitch - dy * 0.0042));
        return;
      }

      if (this.desktop.draggingObj) {
        this.raycaster.setFromCamera(this.desktop.ndc, this.camera);
        this.dragPlane.set(new THREE.Vector3(0, 1, 0), -this.desktop.dragY);
        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.tempVec)) {
          this._clampAndMove(this.desktop.draggingObj, this.tempVec);
        }
        return;
      }

      this.raycaster.setFromCamera(this.desktop.ndc, this.camera);
      const panelHits = this.raycaster.intersectObjects(this.handlers.getPanelMeshes(), false);
      if (panelHits.length > 0 && !panelHits[0].object.userData.isPill) {
        this.handlers.onPanelHover(panelHits[0].uv, this.desktop.pointerDown);
        dom.style.cursor = 'pointer';
      } else {
        this.handlers.onPanelHover(null, false);
        dom.style.cursor = this.desktop.looking ? 'grabbing' : 'grab';
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.renderer.xr.isPresenting) return;
      this.desktop.pointerDown = false;
      this.desktop.looking = false;
      this.desktop.draggingObj = null;
      this.handlers.onPanelUp();
    });
  }

  _setRayFromController(controller) {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
  }

  _clampAndMove(target, worldPos) {
    // Houd objecten binnen een prettige straal (0.85m tot 9.5m)
    const dist = Math.hypot(worldPos.x, worldPos.z);
    let x = worldPos.x;
    let z = worldPos.z;
    if (dist < 0.85) {
      const s = 0.85 / Math.max(0.01, dist);
      x *= s;
      z *= s;
    } else if (dist > 9.5) {
      const s = 9.5 / dist;
      x *= s;
      z *= s;
    }
    this.handlers.onObjectMove(target.id, target.kind, +x.toFixed(2), +z.toFixed(2));
  }

  _onXRSelectStart(entry) {
    entry.selecting = true;
    this._setRayFromController(entry.controller);

    const panelHits = this.raycaster.intersectObjects(this.handlers.getPanelMeshes(), false);
    if (panelHits.length > 0) {
      const hit = panelHits[0];
      const isPill = !!hit.object.userData.isPill;
      this.handlers.onPanelDown(hit.uv, isPill);
      this._haptic(entry, 0.25, 35);
      return;
    }

    if (this.handlers.isBuildMode()) {
      const objHits = this.raycaster.intersectObjects(this.handlers.getObjectMeshes(), false);
      if (objHits.length > 0) {
        const ud = objHits[0].object.userData;
        entry.draggingObj = { id: ud.id, kind: ud.kind };
        entry.dragY = this.handlers.getObjectY(ud.id, ud.kind);
        this.handlers.onObjectSelect(ud.id, ud.kind);
        this._haptic(entry, 0.35, 45);
      }
    }
  }

  _onXRSelectEnd(entry) {
    entry.selecting = false;
    entry.draggingObj = null;
    this.handlers.onPanelUp();
  }

  _haptic(entry, strength = 0.25, ms = 35) {
    try {
      entry.source?.gamepad?.hapticActuators?.[0]?.pulse(strength, ms);
    } catch {}
  }

  update(t, isPlaying) {
    // Desktop camera look
    if (!this.renderer.xr.isPresenting) {
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.desktop.yaw;
      this.camera.rotation.x = this.desktop.pitch;
      return;
    }

    // XR Controllers & Hand presence
    let anyPanelHover = false;
    const panelMeshes = this.handlers.getPanelMeshes();
    const objMeshes = this.handlers.isBuildMode() ? this.handlers.getObjectMeshes() : [];

    for (const entry of this.controllers) {
      // Subtiele hand-aanwezigheid (altijd in VR/MR, ook in Play-modus!)
      const joints = entry.hand.joints;
      const tip = joints?.['index-finger-tip'];
      const palm = joints?.['middle-finger-metacarpal'] || joints?.wrist;
      if (tip?.visible || palm?.visible) {
        (palm?.visible ? palm : tip).getWorldPosition(entry.glow.position);
        entry.glow.visible = true;
      } else if (entry.connected) {
        entry.controller.getWorldPosition(entry.glow.position);
        entry.glow.visible = true;
      } else {
        entry.glow.visible = false;
      }

      if (entry.glow.visible) {
        const { halo, dust, dustPos, count } = entry.glow.userData;
        const pulse = 0.92 + Math.sin(t * 2.5 + entry.index) * 0.14;
        halo.scale.setScalar(pulse);
        for (let k = 0; k < count; k++) {
          const a = t * (0.9 + (k % 3) * 0.3) + k * 0.63;
          const r = 0.065 + (k % 4) * 0.018;
          dustPos[k * 3] = Math.cos(a) * r;
          dustPos[k * 3 + 1] = Math.sin(a * 1.3 + k) * 0.045;
          dustPos[k * 3 + 2] = Math.sin(a) * r;
        }
        dust.geometry.attributes.position.needsUpdate = true;
      }

      // Laserstraal alleen tonen als er interactieve UI is (niet tijdens pure immersion tenzij op pill gericht)
      if (!entry.connected) {
        entry.line.visible = false;
        entry.dot.visible = false;
        continue;
      }

      this._setRayFromController(entry.controller);

      // Draggen van 3D-object in VR
      if (entry.draggingObj && entry.selecting) {
        this.dragPlane.set(new THREE.Vector3(0, 1, 0), -entry.dragY);
        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.tempVec)) {
          this._clampAndMove(entry.draggingObj, this.tempVec);
        }
        entry.line.visible = true;
        entry.dot.visible = false;
        continue;
      }

      const panelHits = this.raycaster.intersectObjects(panelMeshes, false);
      if (panelHits.length > 0) {
        const hit = panelHits[0];
        entry.line.visible = true;
        entry.dot.visible = true;
        entry.dot.position.copy(hit.point);
        if (!hit.object.userData.isPill) {
          this.handlers.onPanelHover(hit.uv, entry.selecting);
          anyPanelHover = true;
        }
        continue;
      }

      if (!isPlaying && objMeshes.length > 0) {
        const objHits = this.raycaster.intersectObjects(objMeshes, false);
        if (objHits.length > 0) {
          entry.line.visible = true;
          entry.dot.visible = true;
          entry.dot.position.copy(objHits[0].point);
          continue;
        }
      }

      entry.line.visible = !isPlaying;
      entry.dot.visible = false;
    }

    if (!anyPanelHover) {
      this.handlers.onPanelHover(null, false);
    }
  }
}
