// Sculpturale 3D-installatie-elementen (Plus-laag) + verfijnde 3D-geluidsringen
import * as THREE from 'three';
import { PROP_TYPES, SOUND_TYPES, MAX_PROPS, MAX_SOUNDS, nextId } from './state.js';
import { createConcreteTextures, createGlowCore, getGlowTexture, createEmberBedTexture } from './materials.js';

let sharedConcrete = null;
let sharedEmberBed = null;
function concreteTex() {
  if (!sharedConcrete) sharedConcrete = createConcreteTextures();
  return sharedConcrete;
}
function emberBedTex() {
  if (!sharedEmberBed) sharedEmberBed = createEmberBedTexture();
  return sharedEmberBed;
}

function createPropMesh(type, colorHex) {
  const group = new THREE.Group();
  const accent = new THREE.Color(colorHex || '#e7b97c');

  if (type === 'zuil') {
    // Architectonische betonnen monoliet met verzonken indirecte lichtsleuf
    const stoneMat = new THREE.MeshStandardMaterial({
      map: concreteTex(),
      color: 0x2b2f36,
      roughness: 0.86,
      metalness: 0.1
    });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.36, 3.1, 0.34), stoneMat);
    left.position.set(-0.24, 1.55, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.36, 3.1, 0.34), stoneMat);
    right.position.set(0.24, 1.55, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.1, 0.36), stoneMat);
    cap.position.set(0, 3.12, 0);

    const slitMat = new THREE.MeshBasicMaterial({ color: accent });
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 2.95), slitMat);
    slit.position.set(0, 1.52, 0.04);
    const slitBack = slit.clone();
    slitBack.rotation.y = Math.PI;
    slitBack.position.z = -0.04;

    const glow = createGlowCore(colorHex, 0.55);
    glow.position.set(0, 1.55, 0.18);
    const light = new THREE.PointLight(accent, 1.2, 6, 1.8);
    light.position.set(0, 1.4, 0.4);

    group.add(left, right, cap, slit, slitBack, glow, light);
    group.userData.basicTintMats = [slitMat];
    group.userData.glowCore = glow;
    group.userData.pointLight = light;
  } else if (type === 'poort') {
    // James Turrell-achtige lichtpoort: ragfijn zwart staal + zacht verend lichtgordijn
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.45, metalness: 0.78 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.75, 0.12), steelMat);
    left.position.set(-0.98, 1.375, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.75, 0.12), steelMat);
    right.position.set(0.98, 1.375, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.08, 0.12), steelMat);
    top.position.set(0, 2.75, 0);

    const curtainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: accent.clone() },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float edgeX = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
          float topGlow = pow(vUv.y, 1.6);
          float border = (1.0 - edgeX) * 0.55;
          float wave = 0.88 + 0.12 * sin(uTime * 1.4 + vUv.y * 5.0);
          float a = (topGlow * 0.28 + border * 0.35) * smoothstep(0.0, 0.12, vUv.y) * wave;
          gl_FragColor = vec4(uColor, a);
        }
      `
    });
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(1.88, 2.68), curtainMat);
    curtain.position.set(0, 1.36, 0);
    const light = new THREE.PointLight(accent, 1.6, 8, 1.6);
    light.position.set(0, 2.2, 0.35);

    group.add(left, right, top, curtain, light);
    group.userData.shaderMat = curtainMat;
    group.userData.pointLight = light;
  } else if (type === 'lichtbol') {
    // Olafur Eliasson lichtbol: matglazen kern + meerlaagse volumetrische halo + fijne messing ring
    const orbMat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.35,
      roughness: 0.22,
      metalness: 0.05
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 28, 20), orbMat);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xb8a384, roughness: 0.35, metalness: 0.85 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.006, 8, 48), ringMat);
    ring.rotation.x = 1.15;

    const glow = createGlowCore(colorHex, 0.95);
    const light = new THREE.PointLight(accent, 2.2, 11, 1.6);

    group.add(orb, ring, glow, light);
    group.userData.tintMat = orbMat;
    group.userData.orbitRing = ring;
    group.userData.glowCore = glow;
    group.userData.pointLight = light;
    group.userData.floatAnim = true;
  } else if (type === 'kampvuur') {
    // Volumetrische vuurplaats: basalt-stenen + verkoolde balken + warmCore vlam + opstijgende vonken
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x242322, roughness: 0.88, metalness: 0.08 });
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + (i % 2) * 0.08;
      const st = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 7), stoneMat);
      st.scale.set(1.25, 0.52, 0.92);
      st.position.set(Math.cos(a) * 0.48, 0.055, Math.sin(a) * 0.48);
      st.rotation.y = a;
      group.add(st);
    }

    // Gloeibed met radiale kolen-textuur (heet in het midden, zwart verkoold aan de rand)
    const emberBedMat = new THREE.MeshBasicMaterial({
      map: emberBedTex(),
      color: accent.clone().lerp(new THREE.Color('#ff8430'), 0.45),
      transparent: true,
      opacity: 0.96
    });
    const bed = new THREE.Mesh(new THREE.CircleGeometry(0.44, 24), emberBedMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = 0.02;
    group.add(bed);

    const logMat = new THREE.MeshStandardMaterial({ color: 0x1d130e, roughness: 0.96 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI + 0.2;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 0.68, 8), logMat);
      log.position.set(Math.cos(a) * 0.05, 0.09, Math.sin(a) * 0.05);
      log.rotation.z = Math.PI / 2 - 0.34;
      log.rotation.y = a;
      group.add(log);
    }

    // Zachte meerlaagse vlam-gloed (warm diep oranje + zachte kern)
    const fireColor = accent.clone().lerp(new THREE.Color('#ff7a22'), 0.45).getStyle();
    const fireGlow = createGlowCore(fireColor, 1.05);
    fireGlow.position.set(0, 0.36, 0);
    group.add(fireGlow);

    // 44 opstijgende gloeiende vonken
    const sparkCount = 44;
    const spPos = new Float32Array(sparkCount * 3);
    const spSeeds = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      spSeeds[i * 3] = Math.random() * Math.PI * 2;
      spSeeds[i * 3 + 1] = Math.random(); // phase
      spSeeds[i * 3 + 2] = 0.4 + Math.random() * 0.7; // speed
    }
    const spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    const spMat = new THREE.PointsMaterial({
      map: getGlowTexture(),
      color: accent.clone().lerp(new THREE.Color('#fff0cf'), 0.4),
      size: 0.09,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sparks = new THREE.Points(spGeo, spMat);
    group.add(sparks);

    const light = new THREE.PointLight(accent, 3.0, 12, 1.5);
    light.position.y = 0.55;
    group.add(light);

    group.userData.tintMat = emberBedMat;
    group.userData.glowCore = fireGlow;
    group.userData.sparkData = { sparks, spPos, spSeeds, spMat, sparkCount };
    group.userData.pointLight = light;
    group.userData.isFire = true;
  } else if (type === 'boom') {
    // Sculpturale groep van 3 slanke donkere bomen met subtiele windbeweging
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1d1714, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: accent.clone().multiplyScalar(0.28).add(new THREE.Color('#0c1512')),
      roughness: 0.88
    });
    const specs = [
      { x: 0, z: 0, s: 1.05 },
      { x: -0.62, z: 0.34, s: 0.78 },
      { x: 0.56, z: -0.28, s: 0.68 }
    ];
    const trees = [];
    for (const sp of specs) {
      const tGrp = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 3.2, 7), trunkMat);
      trunk.position.y = 1.6;
      tGrp.add(trunk);
      for (let tier = 0; tier < 4; tier++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.72 - tier * 0.14, 1.35, 10), leafMat);
        cone.position.y = 1.4 + tier * 0.82;
        cone.rotation.y = tier * 0.8;
        tGrp.add(cone);
      }
      tGrp.position.set(sp.x, 0, sp.z);
      tGrp.scale.setScalar(sp.s);
      group.add(tGrp);
      trees.push(tGrp);
    }
    group.userData.leafMat = leafMat;
    group.userData.swayTrees = trees;
  } else if (type === 'dak') {
    // Verfijnde Fresnel-lichtkoepel boven het hoofd (directe inspiratie uit dome() in zintuigen-vr)
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: accent.clone() },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal, vView, vLocal;
        void main() {
          vUv = uv;
          vLocal = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vNormal, vView, vLocal;
        void main() {
          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);
          vec2 grid = vUv * vec2(16.0, 6.0);
          vec2 d = abs(fract(grid + 0.5) - 0.5);
          float ribs = 1.0 - smoothstep(0.015, 0.045, d.x);
          float rings = 1.0 - smoothstep(0.015, 0.045, d.y);
          float foot = 1.0 - smoothstep(0.0, 0.06, vLocal.y);
          float light = max(ribs * 0.45, max(rings * 0.2, foot * 0.35));
          float breath = 0.9 + 0.1 * sin(uTime * 0.8);
          gl_FragColor = vec4(uColor, (light + fresnel * 0.25) * breath * 0.72);
        }
      `
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.48),
      domeMat
    );
    dome.position.y = -1.2;
    group.add(dome);
    group.userData.shaderMat = domeMat;
  }

  // Ruime onzichtbare hit-collider
  const hitGeo = type === 'lichtbol' || type === 'dak'
    ? new THREE.BoxGeometry(1.1, 0.9, 1.1)
    : new THREE.BoxGeometry(1.3, 2.6, 1.1);
  const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
  hitMesh.position.y = (type === 'lichtbol' || type === 'dak') ? 0 : 1.3;
  group.add(hitMesh);

  // Verfijnde haarlijn-selectiering in warm zand
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.615, 48),
    new THREE.MeshBasicMaterial({ color: 0xe7d8be, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = type === 'lichtbol' ? -0.45 : (type === 'dak' ? -0.25 : 0.025);
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
    new THREE.SphereGeometry(0.08, 16, 12),
    new THREE.MeshBasicMaterial({ color })
  );
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.008, 8, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })
  );
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.006, 8, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 })
  );
  ring2.rotation.x = Math.PI / 2;

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );

  const sel = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.41, 40),
    new THREE.MeshBasicMaterial({ color: 0xe7d8be, side: THREE.DoubleSide })
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
    this.propEntries = new Map();
    this.soundEntries = new Map();
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

    const dist = type === 'dak' ? 0.4 : 2.7;
    const item = {
      id: nextId('prop'),
      type,
      x: +(this._pos.x + this._dir.x * dist).toFixed(2),
      y: meta.defaultY,
      z: +(this._pos.z + this._dir.z * dist).toFixed(2),
      scale: 1.0,
      rotY: Math.atan2(-this._dir.x, -this._dir.z),
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

    const item = {
      id: nextId('snd'),
      type,
      x: +(this._pos.x + this._dir.x * 2.5).toFixed(2),
      y: 1.45,
      z: +(this._pos.z + this._dir.z * 2.5).toFixed(2),
      volume: 0.8
    };
    cue.sounds.push(item);
    return item;
  }

  triggerSoundPulse(id) {
    const entry = this.soundEntries.get(id);
    if (entry) entry.group.userData.pulseScale = 2.2;
  }

  sync(cue, isBuildMode, selectedId) {
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

      const col = new THREE.Color(p.color || '#f4b56a');
      if (entry.group.userData.tintMat) {
        if (entry.group.userData.tintMat.emissive) {
          entry.group.userData.tintMat.emissive.copy(col);
        }
        if (entry.type === 'lichtbol' || entry.type === 'kampvuur') {
          entry.group.userData.tintMat.color.copy(col);
        }
      }
      if (entry.group.userData.basicTintMats) {
        for (const m of entry.group.userData.basicTintMats) m.color.copy(col);
      }
      if (entry.group.userData.shaderMat) {
        entry.group.userData.shaderMat.uniforms.uColor.value.copy(col);
      }
      if (entry.group.userData.glowCore?.userData.setGlowColor) {
        entry.group.userData.glowCore.userData.setGlowColor(p.color || '#f4b56a');
      }
      if (entry.group.userData.sparkData) {
        entry.group.userData.sparkData.spMat.color.copy(col).lerp(new THREE.Color('#fff0cf'), 0.45);
      }
      if (entry.group.userData.pointLight) {
        entry.group.userData.pointLight.color.copy(col);
      }
      if (entry.group.userData.leafMat) {
        entry.group.userData.leafMat.color.copy(col).multiplyScalar(0.28).add(new THREE.Color('#0c1512'));
      }
    }
    for (const [id, entry] of [...this.propEntries.entries()]) {
      if (!propIds.has(id)) {
        this.root.remove(entry.group);
        this.propEntries.delete(id);
      }
    }

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

      if (g.userData.shaderMat?.uniforms?.uTime) {
        g.userData.shaderMat.uniforms.uTime.value = t;
      }

      if (g.userData.isFire && g.userData.glowCore) {
        const flick = 0.92 + Math.sin(t * 9.5 + g.position.x) * 0.08 + Math.cos(t * 16.3) * 0.05;
        g.userData.glowCore.scale.set(flick, flick * (0.96 + Math.sin(t * 12) * 0.08), flick);
        if (g.userData.pointLight) {
          g.userData.pointLight.intensity = 2.6 + Math.sin(t * 11) * 0.55 + Math.cos(t * 18) * 0.25;
        }
        if (g.userData.sparkData) {
          const { sparks, spPos, spSeeds, sparkCount } = g.userData.sparkData;
          for (let i = 0; i < sparkCount; i++) {
            const ang = spSeeds[i * 3];
            const life = (t * spSeeds[i * 3 + 2] * 0.55 + spSeeds[i * 3 + 1]) % 1.0;
            const r = 0.06 + Math.sin(life * Math.PI) * 0.24;
            spPos[i * 3] = Math.cos(ang + life * 2.2) * r;
            spPos[i * 3 + 1] = 0.12 + life * 1.45;
            spPos[i * 3 + 2] = Math.sin(ang + life * 2.2) * r;
          }
          sparks.geometry.attributes.position.needsUpdate = true;
        }
      }

      if (g.userData.floatAnim) {
        g.position.y = entry.data.y + Math.sin(t * 1.3 + entry.data.x) * 0.08;
        if (g.userData.orbitRing) {
          g.userData.orbitRing.rotation.z = t * 0.35;
          g.userData.orbitRing.rotation.y = t * 0.2;
        }
      }

      if (g.userData.swayTrees) {
        g.userData.swayTrees.forEach((tr, i) => {
          tr.rotation.z = Math.sin(t * 0.7 + i * 1.7 + g.position.x) * 0.02;
        });
      }
    }

    for (const entry of this.soundEntries.values()) {
      const g = entry.group;
      if (!g.visible) continue;
      g.children[1].rotation.z = t * 0.5;
      g.children[1].rotation.y = t * 0.35;
      g.userData.selectionRing.lookAt(camera.position);
      if (g.userData.pulseScale > 1.01) {
        g.userData.pulseScale += (1 - g.userData.pulseScale) * Math.min(1, dt * 4.0);
      }
      g.userData.pulseRing.scale.setScalar(g.userData.pulseScale);
    }
  }
}
