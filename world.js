// Wereldbouwer: 4 VR-basisruimtes, MR-passthrough ondersteuning, licht, mist, sky-gradient en deeltjes
import * as THREE from 'three';
import { getColorPalette } from './state.js';

function createSoftDotTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.isAR = false;
    this.currentEnvId = null;
    this.currentParticleType = null;

    // Interpolated live visual state
    this.live = {
      skyTop: new THREE.Color('#1c1310'),
      skyMid: new THREE.Color('#4c2c1b'),
      fogColor: new THREE.Color('#2b1b14'),
      lightColor: new THREE.Color('#ffcf8f'),
      accentColor: new THREE.Color('#f4b56a'),
      brightness: 0.6,
      fog: 0.28,
      pulse: 0.25
    };

    this.target = {
      skyTop: new THREE.Color('#1c1310'),
      skyMid: new THREE.Color('#4c2c1b'),
      fogColor: new THREE.Color('#2b1b14'),
      lightColor: new THREE.Color('#ffcf8f'),
      accentColor: new THREE.Color('#f4b56a'),
      brightness: 0.6,
      fog: 0.28,
      pulse: 0.25
    };

    this.fadeSpeed = 6.0; // instant in build mode, slower during cue transitions

    this._buildLights();
    this._buildSky();
    this._buildEnvironments();
    this._buildParticles();
  }

  _buildLights() {
    this.hemiLight = new THREE.HemisphereLight(0xffdfba, 0x161b26, 0.85);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffcf8f, 1.25);
    this.keyLight.position.set(4, 9, 3);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.PointLight(0x63b4ff, 0.8, 18);
    this.rimLight.position.set(-4, 3.2, -5);
    this.scene.add(this.rimLight);
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(55, 28, 18);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#1c1310') },
        uMid: { value: new THREE.Color('#4c2c1b') },
        uBrightness: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform float uBrightness;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = smoothstep(-0.15, 0.68, h);
          vec3 col = mix(uMid, uTop, t);
          float horizon = exp(-abs(h) * 6.5) * 0.28;
          col += uMid * horizon;
          col *= (0.28 + uBrightness * 1.15);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.skyMesh = new THREE.Mesh(geo, this.skyMat);
    this.scene.add(this.skyMesh);
  }

  _buildEnvironments() {
    this.envRoot = new THREE.Group();
    this.scene.add(this.envRoot);
    this.envs = {};

    // 1. Lege hal (strakke studio-vloer met subtiele cirkel-ringen en verre pilaren)
    const hal = new THREE.Group();
    const halFloor = new THREE.Mesh(
      new THREE.CircleGeometry(32, 48),
      new THREE.MeshStandardMaterial({ color: 0x181e27, roughness: 0.72, metalness: 0.18 })
    );
    halFloor.rotation.x = -Math.PI / 2;
    hal.add(halFloor);

    this.halRings = [];
    [1.6, 3.6, 6.2, 10.0].forEach((r, idx) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.025, r + 0.025, 64),
        new THREE.MeshBasicMaterial({ color: 0xf4b56a, transparent: true, opacity: idx === 0 ? 0.35 : 0.18, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.008;
      hal.add(ring);
      this.halRings.push(ring);
    });

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x202733, roughness: 0.82 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 8.5, 0.55), pillarMat);
      p.position.set(Math.cos(a) * 11.5, 4.25, Math.sin(a) * 11.5);
      p.rotation.y = -a;
      hal.add(p);
    }
    this.envs.hal = hal;
    this.envRoot.add(hal);

    // 2. Water / meer (veilig rond houten vlonder + glinsterend watervlak + verre oever)
    const water = new THREE.Group();
    const dock = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.85, 0.16, 28),
      new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.86 })
    );
    dock.position.y = -0.06;
    water.add(dock);

    const dockRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.035, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0x6b503a, roughness: 0.75 })
    );
    dockRim.rotation.x = Math.PI / 2;
    dockRim.position.y = 0.02;
    water.add(dockRim);

    const waterGeo = new THREE.PlaneGeometry(76, 76, 36, 36);
    waterGeo.rotateX(-Math.PI / 2);
    this.waterGeo = waterGeo;
    this.waterBaseY = new Float32Array(waterGeo.attributes.position.count);
    for (let i = 0; i < this.waterBaseY.length; i++) {
      this.waterBaseY[i] = waterGeo.attributes.position.getY(i);
    }
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x16324a,
      roughness: 0.16,
      metalness: 0.65,
      flatShading: true
    });
    const waterMesh = new THREE.Mesh(waterGeo, this.waterMat);
    waterMesh.position.y = -0.12;
    water.add(waterMesh);

    const hillMat = new THREE.MeshStandardMaterial({ color: 0x121922, roughness: 0.95 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dist = 22 + (i % 3) * 4;
      const h = 2.8 + (i % 4) * 1.4;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(5.5 + (i % 3) * 2, h, 7), hillMat);
      hill.position.set(Math.cos(a) * dist, h * 0.42 - 0.3, Math.sin(a) * dist);
      water.add(hill);
    }
    this.envs.water = water;
    this.envRoot.add(water);

    // 3. Nachtbos (mosgrond + kring gestileerde naaldbomen)
    const bos = new THREE.Group();
    const bosFloor = new THREE.Mesh(
      new THREE.CircleGeometry(34, 40),
      new THREE.MeshStandardMaterial({ color: 0x16221c, roughness: 0.94 })
    );
    bosFloor.rotation.x = -Math.PI / 2;
    bos.add(bosFloor);

    const clearing = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 28),
      new THREE.MeshStandardMaterial({ color: 0x222c23, roughness: 0.95 })
    );
    clearing.rotation.x = -Math.PI / 2;
    clearing.position.y = 0.006;
    bos.add(clearing);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x152b22, roughness: 0.88, flatShading: true });
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2 + ((i * 7) % 5) * 0.06;
      const dist = 5.4 + (i % 4) * 2.6;
      const scale = 0.85 + (i % 5) * 0.22;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.8, 6), trunkMat);
      trunk.position.y = 0.9;
      tree.add(trunk);
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.8, 7), leafMat);
      c1.position.y = 2.6;
      tree.add(c1);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 7), leafMat);
      c2.position.y = 4.1;
      tree.add(c2);
      tree.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
      tree.scale.setScalar(scale);
      bos.add(tree);
    }
    this.envs.bos = bos;
    this.envRoot.add(bos);

    // 4. Schuilplek (knus houten terras/paviljoen met open uitzicht naar voren)
    const schuil = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(34, 40),
      new THREE.MeshStandardMaterial({ color: 0x181d22, roughness: 0.92 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    schuil.add(ground);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4b3526, roughness: 0.84 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x312319, roughness: 0.88 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 3.8), woodMat);
    floor.position.y = -0.04;
    schuil.add(floor);

    // 4 hoekpalen
    const postCoords = [[-1.75, -1.75], [1.75, -1.75], [-1.75, 1.75], [1.75, 1.75]];
    postCoords.forEach(([x, z]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.85, 0.16), darkWoodMat);
      post.position.set(x, 1.4, z);
      schuil.add(post);
    });

    // Lage geborgen zij- en achterwand (open voorkant richting -Z)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.65, 1.15, 0.14), woodMat);
    backWall.position.set(0, 0.58, 1.78);
    schuil.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 3.55), woodMat);
    leftWall.position.set(-1.78, 0.48, 0);
    schuil.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 3.55), woodMat);
    rightWall.position.set(1.78, 0.48, 0);
    schuil.add(rightWall);

    // Pergola-balken boven het hoofd (geeft direct Comfort & geborgenheid)
    for (let i = -3; i <= 3; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.11, 0.16), darkWoodMat);
      beam.position.set(0, 2.82, i * 0.54);
      schuil.add(beam);
    }
    this.envs.schuilplek = schuil;
    this.envRoot.add(schuil);
  }

  _buildParticles() {
    this.particleCount = 420;
    const geo = new THREE.BufferGeometry();
    this.pPositions = new Float32Array(this.particleCount * 3);
    this.pSeeds = new Float32Array(this.particleCount * 3);
    for (let i = 0; i < this.particleCount; i++) {
      this._resetParticle(i, true);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPositions, 3));

    this.particleMat = new THREE.PointsMaterial({
      size: 0.14,
      map: createSoftDotTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xf4b56a
    });

    this.particles = new THREE.Points(geo, this.particleMat);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  _resetParticle(i, randomY = false) {
    const r = 1.1 + Math.random() * 11.5;
    const a = Math.random() * Math.PI * 2;
    this.pPositions[i * 3] = Math.cos(a) * r;
    this.pPositions[i * 3 + 1] = randomY ? Math.random() * 6.5 : 6.2 + Math.random() * 1.5;
    this.pPositions[i * 3 + 2] = Math.sin(a) * r;
    this.pSeeds[i * 3] = Math.random() * Math.PI * 2;
    this.pSeeds[i * 3 + 1] = 0.6 + Math.random() * 1.1;
    this.pSeeds[i * 3 + 2] = Math.random();
  }

  setARMode(isAR) {
    this.isAR = isAR;
    this.skyMesh.visible = !isAR;
    this.envRoot.visible = !isAR;
    if (isAR) {
      this.scene.background = null;
      this.scene.fog = null;
    } else {
      this.scene.fog = new THREE.FogExp2(this.live.fogColor.getHex(), 0.02);
    }
  }

  applyCueTarget(cue, fadeDuration = 0.25) {
    const pal = getColorPalette(cue.color);
    this.target.skyTop.set(pal.skyTop);
    this.target.skyMid.set(pal.skyMid);
    this.target.fogColor.set(pal.fog);
    this.target.lightColor.set(pal.light);
    this.target.accentColor.set(pal.accent);
    this.target.brightness = cue.brightness;
    this.target.fog = cue.fog;
    this.target.pulse = cue.pulse;
    this.fadeSpeed = fadeDuration <= 0.5 ? 10.0 : Math.max(0.45, 2.6 / fadeDuration);

    // Switch environment mesh
    if (this.currentEnvId !== cue.env) {
      this.currentEnvId = cue.env;
      for (const [id, group] of Object.entries(this.envs)) {
        group.visible = id === cue.env;
      }
    }

    // Switch particle style
    if (this.currentParticleType !== cue.particles) {
      this.currentParticleType = cue.particles;
      this.particles.visible = cue.particles !== 'uit';
      if (cue.particles === 'sterren') {
        for (let i = 0; i < this.particleCount; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI * 0.46;
          const dist = 16 + Math.random() * 18;
          this.pPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * dist;
          this.pPositions[i * 3 + 1] = Math.cos(phi) * dist + 1.5;
          this.pPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * dist;
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
      } else {
        for (let i = 0; i < this.particleCount; i++) {
          this._resetParticle(i, true);
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  update(dt, t) {
    const k = Math.min(1, dt * this.fadeSpeed);
    this.live.skyTop.lerp(this.target.skyTop, k);
    this.live.skyMid.lerp(this.target.skyMid, k);
    this.live.fogColor.lerp(this.target.fogColor, k);
    this.live.lightColor.lerp(this.target.lightColor, k);
    this.live.accentColor.lerp(this.target.accentColor, k);
    this.live.brightness += (this.target.brightness - this.live.brightness) * k;
    this.live.fog += (this.target.fog - this.live.fog) * k;
    this.live.pulse += (this.target.pulse - this.live.pulse) * k;

    // Breathing modulation (rustig ademend bij lage pulse, levendiger bij hoge pulse)
    const breathWave = Math.sin(t * (0.9 + this.live.pulse * 1.4));
    const breathMod = 1 + breathWave * this.live.pulse * 0.24;

    // Sky & fog (alleen in VR)
    if (!this.isAR) {
      this.skyMat.uniforms.uTop.value.copy(this.live.skyTop);
      this.skyMat.uniforms.uMid.value.copy(this.live.skyMid);
      this.skyMat.uniforms.uBrightness.value = Math.max(0.05, this.live.brightness * breathMod);

      if (!this.scene.fog) {
        this.scene.fog = new THREE.FogExp2(this.live.fogColor.getHex(), 0.02);
      }
      this.scene.fog.color.copy(this.live.fogColor).multiplyScalar(0.35 + this.live.brightness * 0.85);
      this.scene.fog.density = 0.005 + this.live.fog * 0.115;
    }

    // Lights
    this.hemiLight.color.copy(this.live.lightColor);
    this.hemiLight.intensity = (0.28 + this.live.brightness * 1.15) * breathMod;
    this.keyLight.color.copy(this.live.lightColor);
    this.keyLight.intensity = (0.3 + this.live.brightness * 1.45) * breathMod;
    this.rimLight.color.copy(this.live.accentColor);
    this.rimLight.intensity = (0.4 + this.live.brightness * 1.1) * breathMod;

    // Studio floor rings tint
    if (this.currentEnvId === 'hal' && !this.isAR) {
      for (const ring of this.halRings) {
        ring.material.color.copy(this.live.accentColor);
      }
    }

    // Water gentle waves
    if (this.currentEnvId === 'water' && !this.isAR) {
      this.waterMat.color.copy(this.live.fogColor).lerp(this.live.accentColor, 0.22);
      const pos = this.waterGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = Math.sin(x * 0.35 + t * 1.1) * 0.07 + Math.cos(z * 0.32 + t * 0.85) * 0.06;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // Particles
    const pType = this.currentParticleType;
    if (pType && pType !== 'uit') {
      const pos = this.particles.geometry.attributes.position;
      if (pType === 'regen') {
        this.particleMat.color.set('#b8dbff');
        this.particleMat.size = 0.09;
        this.particleMat.opacity = 0.72;
        for (let i = 0; i < this.particleCount; i++) {
          let y = this.pPositions[i * 3 + 1] - dt * (5.2 + this.pSeeds[i * 3 + 1] * 2.5);
          if (y < 0.05) {
            this._resetParticle(i, false);
          } else {
            this.pPositions[i * 3 + 1] = y;
          }
        }
        pos.needsUpdate = true;
      } else if (pType === 'vuurvliegjes') {
        this.particleMat.color.copy(this.live.accentColor).lerp(new THREE.Color('#ffe08c'), 0.45);
        this.particleMat.size = 0.14 + Math.sin(t * 2.2) * 0.025 * (0.4 + this.live.pulse);
        this.particleMat.opacity = 0.88;
        for (let i = 0; i < this.particleCount; i++) {
          const s = this.pSeeds[i * 3];
          const sp = this.pSeeds[i * 3 + 1];
          this.pPositions[i * 3] += Math.sin(t * 0.55 * sp + s) * dt * 0.28;
          this.pPositions[i * 3 + 1] += Math.cos(t * 0.7 * sp + s) * dt * 0.16;
          this.pPositions[i * 3 + 2] += Math.cos(t * 0.5 * sp + s) * dt * 0.28;
          if (this.pPositions[i * 3 + 1] < 0.3) this.pPositions[i * 3 + 1] = 0.35;
          if (this.pPositions[i * 3 + 1] > 5.0) this.pPositions[i * 3 + 1] = 4.9;
        }
        pos.needsUpdate = true;
      } else if (pType === 'sneeuw') {
        this.particleMat.color.set('#eef6ff');
        this.particleMat.size = 0.11;
        this.particleMat.opacity = 0.8;
        for (let i = 0; i < this.particleCount; i++) {
          const s = this.pSeeds[i * 3];
          this.pPositions[i * 3] += Math.sin(t * 0.7 + s) * dt * 0.22;
          this.pPositions[i * 3 + 1] -= dt * (0.45 + this.pSeeds[i * 3 + 1] * 0.35);
          if (this.pPositions[i * 3 + 1] < 0.05) this._resetParticle(i, false);
        }
        pos.needsUpdate = true;
      } else if (pType === 'stof') {
        this.particleMat.color.copy(this.live.lightColor);
        this.particleMat.size = 0.085;
        this.particleMat.opacity = 0.55;
        for (let i = 0; i < this.particleCount; i++) {
          const s = this.pSeeds[i * 3];
          this.pPositions[i * 3] += Math.sin(t * 0.25 + s) * dt * 0.08;
          this.pPositions[i * 3 + 1] += Math.cos(t * 0.3 + s) * dt * 0.05;
        }
        pos.needsUpdate = true;
      } else if (pType === 'sterren') {
        this.particleMat.color.set('#ffffff');
        this.particleMat.size = 0.26;
        this.particleMat.opacity = 0.85 * (0.7 + 0.3 * Math.sin(t * 0.8));
        this.particles.rotation.y = t * 0.012;
      }
      if (pType !== 'sterren') {
        this.particles.rotation.y = 0;
      }
    }
  }
}
