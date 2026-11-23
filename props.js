// Rudimentaire 3D-elementen (Plus-laag) + 3D-geluidsbollen met kijk-en-plaats en directe selectie/slepen
import * as THREE from 'three';
import { PROP_TYPES, SOUND_TYPES, MAX_PROPS, MAX_SOUNDS, nextId } from './state.js';

function createPropMesh(type, colorHex) {
  const group = new THREE.Group();
  const accent = new THREE.Color(colorHex || '#f4b56a');

  if (type === 'zuil') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 2.75, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x2a313d, roughness: 0.78, metalness: 0.12 })
    );
    body.position.y = 1.375;
    group.add(body);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 2.4, 0.41),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.75, roughness: 0.3 })
    );
    strip.position.y = 1.375;
    group.add(strip);
    group.userData.tintMat = strip.material;
  } else if (type === 'poort') {
    const mat = new THREE.MeshStandardMaterial({ color: 0x262e3a, roughness: 0.72, metalness: 0.2 });
    const glowMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.9, roughness: 0.25 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.6, 0.28), mat);
    left.position.set(-0.95, 1.3, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.6, 0.28), mat);
    right.position.set(0.95, 1.3, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, 0.3), mat);
    top.position.set(0, 2.62, 0);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.08, 0.14), glowMat);
    inner.position.set(0, 2.46, 0);
    group.add(left, right, top, inner);
    group.userData.tintMat = glowMat;
  } else if (type === 'lichtbol') {
    const orbMat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.5,
      roughness: 0.15
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 22, 16), orbMat);
    const haloMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12), haloMat);
    const light = new THREE.PointLight(accent, 1.8, 9);
    group.add(orb, halo, light);
    group.userData.tintMat = orbMat;
    group.userData.haloMat = haloMat;
    group.userData.pointLight = light;
    group.userData.floatAnim = true;
  } else if (type === 'kampvuur') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.92, flatShading: true });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), stoneMat);
      stone.position.set(Math.cos(a) * 0.44, 0.1, Math.sin(a) * 0.44);
      stone.scale.set(1.1, 0.65, 1.0);
      group.add(stone);
    }
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3d281c, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.72, 7), logMat);
      log.position.y = 0.12;
      log.rotation.z = Math.PI / 2 - 0.25;
      log.rotation.y = (i / 3) * Math.PI;
      group.add(log);
    }
    const flameMat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      flatShading: true
    });
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 6), flameMat);
    f1.position.y = 0.44;
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.52, 5), flameMat);
    f2.position.set(0.1, 0.34, 0.08);
    const light = new THREE.PointLight(accent, 2.4, 11);
    light.position.y = 0.7;
    group.add(f1, f2, light);
    group.userData.tintMat = flameMat;
    group.userData.flames = [f1, f2];
    group.userData.pointLight = light;
  } else if (type === 'boom') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.2, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.92 })
    );
    trunk.position.y = 0.55;
    const leafMat = new THREE.MeshStandardMaterial({
      color: accent.clone().multiplyScalar(0.55),
      roughness: 0.82,
      flatShading: true
    });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.9, 7), leafMat);
    c1.position.y = 1.75;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.45, 7), leafMat);
    c2.position.y = 2.85;
    group.add(trunk, c1, c2);
    group.userData.leafMat = leafMat;
  } else if (type === 'dak') {
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x3b2f28, roughness: 0.82 });
    const glowMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.55 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 2.6), beamMat);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 2.4), glowMat);
    rim.position.y = -0.08;
    group.add(slab, rim);
    group.userData.tintMat = glowMat;
  }

  // Onzichtbare ruime selectie-collider voor makkelijk wijzen/slepen in VR
  const hitGeo = type === 'lichtbol' || type === 'dak'
    ? new THREE.BoxGeometry(1.1, 0.9, 1.1)
    : new THREE.BoxGeometry(1.3, 2.5, 1.1);
  const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
  hitMesh.position.y = (type === 'lichtbol' || type === 'dak') ? 0 : 1.25;
  group.add(hitMesh);

  // Selectie-ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.68, 32),
    new THREE.MeshBasicMaterial({ color: 0x2bb3a3, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = type === 'lichtbol' ? -0.45 : (type === 'dak' ? -0.25 : 0.03);
  ring.visible = false;
  group.add(ring);
  group.userData.selectionRing = ring;
  group.userData.hitMesh = hitMesh;

  return group;
}

function createSoundOrbMesh(type) {
  const meta = SOUND_TYPES.find(s => s.id === type) || SOUND_TYPES[0];
  const color = new THREE.Color(meta.color);
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 1),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.25, roughness: 0.2 })
  );
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.018, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
  );
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.012, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })
  );
  ring2.rotation.x = Math.PI / 2;

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );

  const sel = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.53, 28),
    new THREE.MeshBasicMaterial({ color: 0x2bb3a3, side: THREE.DoubleSide })
  );
  sel.visible = false;

  group.add(core, ring1, ring2, hitMesh, sel);
  group.userData.hitMesh = hitMesh;
  group.userData.selectionRing = sel;
  group.userData.pulseRing = ring2;
  group.userData.pulseScale = 1;
  return group;
}

export class PropsManager {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.propEntries = new Map();  // id -> { data, group }
    this.soundEntries = new Map(); // id -> { data, group }
    this._dir = new THREE.Vector3();
    this._pos = new THREE.Vector3();
  }

  getInteractiveTargets(includeSounds = true) {
    const list = [];
    for (const entry of this.propEntries.values()) {
      list.push(entry.group.userData.hitMesh);
    }
    if (includeSounds) {
      for (const entry of this.soundEntries.values()) {
        if (entry.group.visible) list.push(entry.group.userData.hitMesh);
      }
    }
    return list;
  }

  spawnProp(cue, type, camera) {
    if ((cue.props || []).length >= MAX_PROPS) return null;
    const meta = PROP_TYPES.find(p => p.id === type) || PROP_TYPES[0];
    camera.getWorldPosition(this._pos);
    camera.getWorldDirection(this._dir);
    this._dir.y = 0;
    if (this._dir.lengthSq() < 0.001) this._dir.set(0, 0, -1);
    this._dir.normalize();

    const dist = type === 'dak' ? 0.6 : 2.6;
    const x = +(this._pos.x + this._dir.x * dist).toFixed(2);
    const z = +(this._pos.z + this._dir.z * dist).toFixed(2);
    const y = meta.defaultY;
    const rotY = Math.atan2(-this._dir.x, -this._dir.z);

    const item = {
      id: nextId('prop'),
      type,
      x,
      y,
      z,
      scale: 1.0,
      rotY,
      color: '#f4b56a'
    };
    cue.props.push(item);
    return item;
  }

  spawnSound(cue, type, camera) {
    if ((cue.sounds || []).length >= MAX_SOUNDS) return null;
    camera.getWorldPosition(this._pos);
    camera.getWorldDirection(this._dir);
    this._dir.y = 0;
    if (this._dir.lengthSq() < 0.001) this._dir.set(0, 0, -1);
    this._dir.normalize();

    const dist = 2.4;
    const item = {
      id: nextId('snd'),
      type,
      x: +(this._pos.x + this._dir.x * dist).toFixed(2),
      y: 1.45,
      z: +(this._pos.z + this._dir.z * dist).toFixed(2),
      volume: 0.8
    };
    cue.sounds.push(item);
    return item;
  }

  triggerSoundPulse(id) {
    const entry = this.soundEntries.get(id);
    if (entry) {
      entry.group.userData.pulseScale = 2.1;
    }
  }

  sync(cue, isBuildMode, selectedId) {
    // Sync Props
    const propIds = new Set();
    for (const p of cue.props || []) {
      propIds.add(p.id);
      let entry = this.propEntries.get(p.id);
      if (!entry || entry.type !== p.type) {
        if (entry) this.root.remove(entry.group);
        const group = createPropMesh(p.type, p.color);
        group.userData.hitMesh.userData = { interactive: true, id: p.id, kind: 'prop' };
        this.root.add(group);
        entry = { type: p.type, group, data: p };
        this.propEntries.set(p.id, entry);
      }
      entry.data = p;
      entry.group.position.set(p.x, p.y, p.z);
      entry.group.scale.setScalar(p.scale || 1);
      entry.group.rotation.y = p.rotY || 0;
      entry.group.userData.selectionRing.visible = isBuildMode && selectedId === p.id;

      // Apply tint color
      const col = new THREE.Color(p.color || '#f4b56a');
      if (entry.group.userData.tintMat) {
        entry.group.userData.tintMat.color.copy(col);
        entry.group.userData.tintMat.emissive.copy(col);
      }
      if (entry.group.userData.haloMat) {
        entry.group.userData.haloMat.color.copy(col);
      }
      if (entry.group.userData.pointLight) {
        entry.group.userData.pointLight.color.copy(col);
      }
      if (entry.group.userData.leafMat) {
        entry.group.userData.leafMat.color.copy(col).multiplyScalar(0.55);
      }
    }
    for (const [id, entry] of [...this.propEntries.entries()]) {
      if (!propIds.has(id)) {
        this.root.remove(entry.group);
        this.propEntries.delete(id);
      }
    }

    // Sync Sound Orbs (alleen zichtbaar in Build-modus!)
    const sndIds = new Set();
    for (const s of cue.sounds || []) {
      sndIds.add(s.id);
      let entry = this.soundEntries.get(s.id);
      if (!entry || entry.type !== s.type) {
        if (entry) this.root.remove(entry.group);
        const group = createSoundOrbMesh(s.type);
        group.userData.hitMesh.userData = { interactive: true, id: s.id, kind: 'sound' };
        this.root.add(group);
        entry = { type: s.type, group, data: s };
        this.soundEntries.set(s.id, entry);
      }
      entry.data = s;
      entry.group.visible = isBuildMode;
      entry.group.position.set(s.x, s.y, s.z);
      entry.group.userData.selectionRing.visible = isBuildMode && selectedId === s.id;
    }
    for (const [id, entry] of [...this.soundEntries.entries()]) {
      if (!sndIds.has(id)) {
        this.root.remove(entry.group);
        this.soundEntries.delete(id);
      }
    }
  }

  update(dt, t, camera) {
    for (const entry of this.propEntries.values()) {
      const g = entry.group;
      if (g.userData.flames) {
        const [f1, f2] = g.userData.flames;
        const flick = 0.88 + Math.sin(t * 14 + g.position.x) * 0.14 + Math.cos(t * 21) * 0.08;
        f1.scale.set(1, flick, 1);
        f2.scale.set(1, 0.9 + Math.cos(t * 17) * 0.18, 1);
        if (g.userData.pointLight) {
          g.userData.pointLight.intensity = 2.0 + Math.sin(t * 13) * 0.55;
        }
      }
      if (g.userData.floatAnim) {
        g.position.y = entry.data.y + Math.sin(t * 1.6 + entry.data.x) * 0.09;
      }
    }

    for (const entry of this.soundEntries.values()) {
      const g = entry.group;
      if (!g.visible) continue;
      g.children[0].rotation.y = t * 0.9;
      g.children[1].rotation.z = t * 0.6;
      g.userData.selectionRing.lookAt(camera.position);
      if (g.userData.pulseScale > 1.01) {
        g.userData.pulseScale += (1 - g.userData.pulseScale) * Math.min(1, dt * 4.5);
      }
      g.userData.pulseRing.scale.setScalar(g.userData.pulseScale);
    }
  }
}
