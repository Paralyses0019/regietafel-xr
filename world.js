// Sfeerwereld v2: procedurele PBR-materialen, FBM-luchtshader, zwevende mist-veils,
// echte LineSegments-regen en shader-deeltjes met warme gloedkern
import * as THREE from 'three';
import { getColorPalette } from './state.js';
import { createStoneTextures, createWoodTextures, createConcreteTextures, createLinenTexture } from './materials.js';

function displayOutput(fragment) {
  const end = fragment.lastIndexOf('}');
  return fragment.slice(0, end) + '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n' + fragment.slice(end);
}

const NOISE_GLSL = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.04;
    a *= 0.5;
  }
  return v;
}`;

export class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.isAR = false;
    this.currentEnvId = null;
    this.currentParticleType = null;

    this.stoneTex = createStoneTextures();
    this.woodTex = createWoodTextures();
    this.concreteTex = createConcreteTextures();
    this.linenTex = createLinenTexture();

    this.live = {
      skyTop: new THREE.Color('#0c0b10'),
      skyMid: new THREE.Color('#3b2316'),
      fogColor: new THREE.Color('#1d1411'),
      lightColor: new THREE.Color('#ffcf96'),
      accentColor: new THREE.Color('#e7b97c'),
      brightness: 0.6,
      fog: 0.28,
      pulse: 0.25
    };
    this.target = {
      skyTop: this.live.skyTop.clone(),
      skyMid: this.live.skyMid.clone(),
      fogColor: this.live.fogColor.clone(),
      lightColor: this.live.lightColor.clone(),
      accentColor: this.live.accentColor.clone(),
      brightness: 0.6,
      fog: 0.28,
      pulse: 0.25
    };
    this.fadeSpeed = 6.0;

    this._buildLights();
    this._buildSkyAndVeils();
    this._buildEnvironments();
    this._buildRain();
    this._buildParticles();
  }

  _buildLights() {
    this.hemiLight = new THREE.HemisphereLight(0xffdfba, 0x0d1016, 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffcf96, 1.35);
    this.keyLight.position.set(5, 11, -4);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.PointLight(0x88b4e0, 0.95, 22, 1.6);
    this.rimLight.position.set(-5, 3.6, -5);
    this.scene.add(this.rimLight);
  }

  _buildSkyAndVeils() {
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    this.skyUniforms = {
      uTop: { value: new THREE.Color('#0b0c12') },
      uMid: { value: new THREE.Color('#3a2318') },
      uTime: { value: 0 },
      uBrightness: { value: 0.6 }
    };

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: displayOutput(`
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform float uTime;
        uniform float uBrightness;
        varying vec3 vDir;
        ${NOISE_GLSL}
        void main() {
          vec3 d = normalize(vDir);
          float h = smoothstep(-0.1, 0.72, d.y);
          vec2 uv = d.xz / (abs(d.y) + 0.42);
          float cloud = fbm(uv * 1.4 + vec2(uTime * 0.008, -uTime * 0.005));
          vec3 col = mix(uMid, uTop, h);
          col *= (0.78 + 0.34 * cloud);
          float horizonBand = exp(-abs(d.y + 0.02) * 8.0) * 0.42;
          col += uMid * horizonBand * (0.7 + 0.5 * cloud);
          col *= (0.24 + uBrightness * 1.15);
          gl_FragColor = vec4(col, 1.0);
        }
      `)
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 36, 20), skyMat);
    sky.renderOrder = -20;
    this.skyGroup.add(sky);

    // 4 zachte, langzaam drijvende mist-veils rond de horizon (diepte zonder zware kosten)
    this.veilUniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#3b2820') },
      uOpacity: { value: 0.24 }
    };
    const veilMat = new THREE.ShaderMaterial({
      uniforms: this.veilUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: displayOutput(`
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          vec2 edge = smoothstep(0.0, 0.28, vUv) * smoothstep(1.0, 0.72, vUv);
          float n = fbm(vUv * vec2(4.5, 2.2) + vec2(uTime * 0.022, -uTime * 0.007));
          float alpha = edge.x * edge.y * smoothstep(0.28, 0.85, n) * uOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `)
    });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.35;
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(34, 9), veilMat);
      veil.position.set(Math.cos(a) * 18, 3.2, Math.sin(a) * 18);
      veil.lookAt(0, 3.2, 0);
      this.skyGroup.add(veil);
    }
  }

  _buildEnvironments() {
    this.envRoot = new THREE.Group();
    this.scene.add(this.envRoot);
    this.envs = {};

    // 1. Donkere galerie / betonnen hal (natte reflecterende steenvloer + slanke zuilen)
    const hal = new THREE.Group();
    const halFloor = new THREE.Mesh(
      new THREE.CircleGeometry(38, 64),
      new THREE.MeshStandardMaterial({
        map: this.stoneTex.map,
        roughnessMap: this.stoneTex.roughnessMap,
        bumpMap: this.stoneTex.bumpMap,
        bumpScale: 0.025,
        roughness: 0.9,
        metalness: 0.14
      })
    );
    halFloor.rotation.x = -Math.PI / 2;
    hal.add(halFloor);

    this.halRings = [];
    [1.8, 4.2, 7.6].forEach((r, idx) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.009, r + 0.009, 96),
        new THREE.MeshBasicMaterial({
          color: 0xd8c3a5,
          transparent: true,
          opacity: idx === 0 ? 0.24 : 0.11,
          side: THREE.DoubleSide
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      hal.add(ring);
      this.halRings.push(ring);
    });

    const colMat = new THREE.MeshStandardMaterial({
      map: this.concreteTex,
      roughness: 0.85,
      metalness: 0.08,
      color: 0x3b4048
    });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.16;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 11.5, 0.42), colMat);
      p.position.set(Math.cos(a) * 12.5, 5.75, Math.sin(a) * 12.5);
      p.rotation.y = -a;
      hal.add(p);
    }
    this.envs.hal = hal;
    this.envRoot.add(hal);

    // 2. Spiegelmeer (glinsterende Fresnel-watershader + verweerde houten steiger)
    const water = new THREE.Group();
    const dockMat = new THREE.MeshStandardMaterial({
      map: this.woodTex.map,
      bumpMap: this.woodTex.bumpMap,
      bumpScale: 0.02,
      roughness: 0.78,
      metalness: 0.06
    });
    const dock = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.92, 0.14, 48), dockMat);
    dock.position.y = -0.05;
    water.add(dock);

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x262422, roughness: 0.55, metalness: 0.75 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.42, 10), ironMat);
      post.position.set(Math.cos(a) * 1.72, 0.18, Math.sin(a) * 1.72);
      water.add(post);
    }

    this.waterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#0a1622') },
      uReflect: { value: new THREE.Color('#4a6682') },
      uFogColor: { value: new THREE.Color('#182430') },
      uFogDensity: { value: 0.035 }
    };
    const waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: displayOutput(`
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uReflect;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec3 vWorldPos;
        ${NOISE_GLSL}
        void main() {
          vec2 p = vWorldPos.xz;
          float r1 = fbm(p * 0.42 + vec2(uTime * 0.14, uTime * 0.09));
          float r2 = fbm(p * 0.85 - vec2(uTime * 0.11, -uTime * 0.13));
          vec3 n = normalize(vec3((r1 - 0.5) * 0.24, 1.0, (r2 - 0.5) * 0.24));
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(0.0, dot(n, viewDir)), 3.2);
          float glint = pow(max(0.0, dot(reflect(-normalize(vec3(0.3, 0.65, -0.7)), n), viewDir)), 28.0);
          vec3 col = mix(uDeep, uReflect, clamp(fresnel * 1.15, 0.0, 1.0));
          col += uReflect * glint * 0.85;
          float dist = length(cameraPosition - vWorldPos);
          float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
          col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `)
    });
    const waterPlane = new THREE.Mesh(new THREE.PlaneGeometry(110, 110, 1, 1), waterMat);
    waterPlane.rotation.x = -Math.PI / 2;
    waterPlane.position.y = -0.1;
    water.add(waterPlane);

    // Zachte verre heuvelsilhouetten langs de horizon
    const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 1.0 });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const dist = 26 + (i % 3) * 6;
      const h = 2.4 + (i % 4) * 1.5;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(6.5 + (i % 3) * 3, 12, 8), ridgeMat);
      hill.scale.set(1.6, h / 6.5, 1.0);
      hill.position.set(Math.cos(a) * dist, -0.4, Math.sin(a) * dist);
      hill.rotation.y = -a;
      water.add(hill);
    }
    this.envs.water = water;
    this.envRoot.add(water);

    // 3. Mistbos (textuur-bosgrond + slanke gelaagde donkere ceder-silhouetten)
    const bos = new THREE.Group();
    const bosFloor = new THREE.Mesh(
      new THREE.CircleGeometry(38, 48),
      new THREE.MeshStandardMaterial({
        map: this.stoneTex.map,
        bumpMap: this.stoneTex.bumpMap,
        bumpScale: 0.03,
        color: 0x26322b,
        roughness: 0.94
      })
    );
    bosFloor.rotation.x = -Math.PI / 2;
    bos.add(bosFloor);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1b1512, roughness: 0.95 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x101c17, roughness: 0.92 });
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * Math.PI * 2 + ((i * 11) % 7) * 0.05;
      const band = i % 3;
      const dist = 5.4 + band * 3.8 + (i % 5) * 0.65;
      const hScale = 0.85 + ((i * 7) % 6) * 0.22;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 4.8, 7), trunkMat);
      trunk.position.y = 2.4;
      tree.add(trunk);
      // 4 slanke, verfijnde taklagen (geen dikke strip-kegels)
      for (let tier = 0; tier < 4; tier++) {
        const radius = 0.95 - tier * 0.18;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.75, 9), canopyMat);
        cone.position.y = 2.1 + tier * 1.15;
        cone.rotation.y = tier * 0.7;
        tree.add(cone);
      }
      tree.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
      tree.scale.set(0.85 + (i % 3) * 0.15, hScale, 0.85 + (i % 3) * 0.15);
      bos.add(tree);
    }
    this.envs.bos = bos;
    this.envRoot.add(bos);

    // 4. Schuilplek (architectonisch linnen tent-paviljoen op slanke ijzeren palen — knipoog naar zintuigen-vr)
    const schuil = new THREE.Group();
    const sGround = new THREE.Mesh(
      new THREE.CircleGeometry(38, 48),
      new THREE.MeshStandardMaterial({
        map: this.stoneTex.map,
        roughnessMap: this.stoneTex.roughnessMap,
        bumpMap: this.stoneTex.bumpMap,
        bumpScale: 0.025,
        color: 0x3b4148,
        roughness: 0.85
      })
    );
    sGround.rotation.x = -Math.PI / 2;
    sGround.position.y = -0.02;
    schuil.add(sGround);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 3.2), dockMat);
    deck.position.y = 0.02;
    schuil.add(deck);

    this.tentMat = new THREE.MeshStandardMaterial({
      map: this.linenTex,
      color: 0xdcc4a4,
      emissive: 0xa86c3a,
      emissiveIntensity: 0.11,
      roughness: 0.94,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });

    // Zachte verre boom- en heuvelsilhouetten rondom de schuilplek voor diepte aan de horizon
    const farSilMat = new THREE.MeshStandardMaterial({ color: 0x0d1115, roughness: 0.98 });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + 0.15;
      const dist = 14 + (i % 3) * 4.5;
      const h = 3.5 + (i % 4) * 1.4;
      const tree = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (i % 3) * 0.45, h, 8), farSilMat);
      tree.position.set(Math.cos(a) * dist, h * 0.45, Math.sin(a) * dist);
      schuil.add(tree);
    }

    const halfW = 1.48;
    const depth = 1.45;
    const eaveY = 1.65;
    const ridgeY = 2.72;
    const slopeLen = Math.hypot(halfW, ridgeY - eaveY);
    const slopeAng = Math.atan2(ridgeY - eaveY, halfW);

    for (const side of [-1, 1]) {
      // Slanke ijzeren hoekpalen
      for (const z of [-depth, depth]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, eaveY, 8), ironMat);
        post.position.set(side * halfW, eaveY / 2, z);
        schuil.add(post);

        const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, slopeLen, 8), ironMat);
        spar.position.set(side * halfW * 0.5, (eaveY + ridgeY) * 0.5, z);
        spar.rotation.z = side * (Math.PI / 2 - slopeAng);
        schuil.add(spar);
      }
      // Zijwand (halfhoog open naar voren voor luchtigheid)
      const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(depth * 2, eaveY), this.tentMat);
      sideWall.position.set(side * halfW, eaveY / 2, 0);
      sideWall.rotation.y = side * Math.PI / 2;
      schuil.add(sideWall);

      // Dakpaneel
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(slopeLen, depth * 2), this.tentMat);
      roof.position.set(side * halfW * 0.5, (eaveY + ridgeY) * 0.5, 0);
      roof.rotation.x = -Math.PI / 2;
      roof.rotation.y = side * slopeAng;
      schuil.add(roof);
    }

    // Achterwand (open voorkant richting -Z)
    const backShape = new THREE.Shape();
    backShape.moveTo(-halfW, 0);
    backShape.lineTo(-halfW, eaveY);
    backShape.lineTo(0, ridgeY);
    backShape.lineTo(halfW, eaveY);
    backShape.lineTo(halfW, 0);
    const backPanel = new THREE.Mesh(new THREE.ShapeGeometry(backShape), this.tentMat);
    backPanel.position.z = depth;
    schuil.add(backPanel);

    // Nokbalk
    const ridgeBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, depth * 2, 8), ironMat);
    ridgeBeam.rotation.x = Math.PI / 2;
    ridgeBeam.position.y = ridgeY;
    schuil.add(ridgeBeam);

    this.envs.schuilplek = schuil;
    this.envRoot.add(schuil);
  }

  // Echte streepjes-regen met LineSegments (direct geïnspireerd op zintuigen-vr)
  _buildRain() {
    const count = 950;
    const positions = new Float32Array(count * 6);
    const phases = new Float32Array(count * 2);
    const ends = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      const y = Math.random() * 11;
      const phase = Math.random() * 11;
      const len = 0.34 + Math.random() * 0.28;
      positions.set([x, y, z, x + 0.045, y + len, z], i * 6);
      phases.set([phase, phase], i * 2);
      ends.set([0, 1], i * 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));

    this.rainUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0.58 },
      uShelter: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.rainUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aPhase, aEnd;
        uniform float uTime, uShelter;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y = mod(aPhase - uTime * 6.8, 11.0) - 0.5 + aEnd * 0.45;
          p.x += sin(uTime * 0.3) * 0.18;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = length(mv.xyz);
          vAlpha = mix(0.75, 0.05, aEnd) * exp(-dist * dist * 0.008);
          if (p.y < 0.0 || (uShelter > 0.5 && abs(p.x) < 1.55 && abs(p.z) < 1.55 && p.y < 2.7)) {
            vAlpha = 0.0;
          }
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: displayOutput(`
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(0.68, 0.8, 0.92, vAlpha * uOpacity);
        }
      `)
    });
    this.rainMesh = new THREE.LineSegments(geo, mat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);
  }

  // Shader-gestuurde gloeideeltjes (hot core + zachte halo + eigen twinkeling)
  _buildParticles() {
    this.particleCount = 340;
    const geo = new THREE.BufferGeometry();
    this.pPositions = new Float32Array(this.particleCount * 3);
    this.pSizes = new Float32Array(this.particleCount);
    this.pPhases = new Float32Array(this.particleCount);
    this.pSeeds = new Float32Array(this.particleCount * 2);

    for (let i = 0; i < this.particleCount; i++) {
      this._resetParticle(i, true);
      this.pSizes[i] = 0.065 + Math.random() * 0.095;
      this.pPhases[i] = Math.random() * Math.PI * 2;
      this.pSeeds[i * 2] = Math.random() * Math.PI * 2;
      this.pSeeds[i * 2 + 1] = 0.5 + Math.random() * 0.9;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.pPositions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.pSizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(this.pPhases, 1));

    this.pUniforms = {
      uTime: { value: 0 },
      uProjection: { value: 650 },
      uColor: { value: new THREE.Color('#ffcb82') },
      uOpacity: { value: 0.9 },
      uTwinkle: { value: 1.0 },
      uSizeScale: { value: 1.0 }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.pUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSize, aPhase;
        uniform float uTime, uProjection, uTwinkle, uSizeScale;
        varying float vLight, vDepth;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = length(mv.xyz);
          float pulse = 0.5 + 0.5 * sin(uTime * (0.7 + 0.25 * sin(aPhase)) + aPhase);
          vLight = mix(0.82, 0.16 + 0.84 * pow(pulse, 2.0), uTwinkle);
          gl_PointSize = clamp(aSize * uSizeScale * uProjection / max(0.2, -mv.z), 1.5, 64.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: displayOutput(`
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vLight, vDepth;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          if (r >= 1.0) discard;
          float halo = exp(-r * r * 5.2) * pow(1.0 - r, 1.3);
          float core = exp(-r * r * 75.0);
          float distFade = exp(-vDepth * vDepth * 0.004);
          vec3 col = mix(uColor, vec3(1.0, 0.96, 0.86), core * 0.72);
          gl_FragColor = vec4(col, (halo * 0.65 + core * 0.62) * vLight * uOpacity * distFade);
        }
      `)
    });

    this.particles = new THREE.Points(geo, mat);
    this.particles.frustumCulled = false;
    const vp = new THREE.Vector4();
    this.particles.onBeforeRender = (renderer, _scene, cam) => {
      renderer.getCurrentViewport(vp);
      this.pUniforms.uProjection.value = vp.w * cam.projectionMatrix.elements[5] * 0.5;
    };
    this.scene.add(this.particles);
  }

  _resetParticle(i, randomY = false) {
    const r = 1.0 + Math.random() * 10.5;
    const a = Math.random() * Math.PI * 2;
    this.pPositions[i * 3] = Math.cos(a) * r;
    this.pPositions[i * 3 + 1] = randomY ? 0.2 + Math.random() * 5.2 : 5.6 + Math.random() * 1.4;
    this.pPositions[i * 3 + 2] = Math.sin(a) * r;
  }

  setARMode(isAR) {
    this.isAR = isAR;
    this.skyGroup.visible = !isAR;
    this.envRoot.visible = !isAR;
    if (isAR) {
      this.scene.background = null;
      this.scene.fog = null;
    } else {
      this.scene.fog = new THREE.FogExp2(this.live.fogColor.getHex(), 0.025);
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

    if (this.currentEnvId !== cue.env) {
      this.currentEnvId = cue.env;
      for (const [id, group] of Object.entries(this.envs)) {
        group.visible = id === cue.env;
      }
    }

    if (this.currentParticleType !== cue.particles) {
      this.currentParticleType = cue.particles;
      this.rainMesh.visible = cue.particles === 'regen';
      this.particles.visible = cue.particles !== 'uit' && cue.particles !== 'regen';

      if (cue.particles === 'sterren') {
        for (let i = 0; i < this.particleCount; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI * 0.45;
          const dist = 16 + Math.random() * 20;
          this.pPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * dist;
          this.pPositions[i * 3 + 1] = Math.cos(phi) * dist + 1.5;
          this.pPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * dist;
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
      } else if (this.particles.visible) {
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

    const breathWave = Math.sin(t * (0.8 + this.live.pulse * 1.3));
    const breathMod = 1 + breathWave * this.live.pulse * 0.2;

    if (!this.isAR) {
      this.skyUniforms.uTop.value.copy(this.live.skyTop);
      this.skyUniforms.uMid.value.copy(this.live.skyMid);
      this.skyUniforms.uTime.value = t;
      this.skyUniforms.uBrightness.value = Math.max(0.06, this.live.brightness * breathMod);

      this.veilUniforms.uTime.value = t;
      this.veilUniforms.uColor.value.copy(this.live.skyMid).lerp(this.live.accentColor, 0.25);
      this.veilUniforms.uOpacity.value = 0.08 + this.live.fog * 0.34;

      if (!this.scene.fog) {
        this.scene.fog = new THREE.FogExp2(this.live.fogColor.getHex(), 0.025);
      }
      this.scene.fog.color.copy(this.live.fogColor).multiplyScalar(0.32 + this.live.brightness * 0.85);
      this.scene.fog.density = 0.008 + this.live.fog * 0.095;
    }

    this.hemiLight.color.copy(this.live.lightColor);
    this.hemiLight.intensity = (0.25 + this.live.brightness * 0.95) * breathMod;
    this.keyLight.color.copy(this.live.lightColor);
    this.keyLight.intensity = (0.28 + this.live.brightness * 1.35) * breathMod;
    this.rimLight.color.copy(this.live.accentColor);
    this.rimLight.intensity = (0.35 + this.live.brightness * 1.1) * breathMod;

    // Omgevingsdetails bijwerken
    if (this.currentEnvId === 'hal' && !this.isAR) {
      for (const ring of this.halRings) {
        ring.material.color.copy(this.live.accentColor);
      }
    }
    if (this.currentEnvId === 'water' && !this.isAR) {
      this.waterUniforms.uTime.value = t;
      this.waterUniforms.uDeep.value.copy(this.live.skyTop).multiplyScalar(0.7);
      this.waterUniforms.uReflect.value.copy(this.live.skyMid).lerp(this.live.lightColor, 0.35);
      this.waterUniforms.uFogColor.value.copy(this.scene.fog.color);
      this.waterUniforms.uFogDensity.value = this.scene.fog.density;
    }
    if (this.currentEnvId === 'schuilplek' && !this.isAR) {
      this.tentMat.emissive.copy(this.live.accentColor);
      this.tentMat.emissiveIntensity = 0.1 + this.live.brightness * 0.2;
    }

    // Regen shader
    if (this.rainMesh.visible) {
      this.rainUniforms.uTime.value = t;
      this.rainUniforms.uShelter.value = (!this.isAR && this.currentEnvId === 'schuilplek') ? 1.0 : 0.0;
    }

    // Shader deeltjes
    const pType = this.currentParticleType;
    if (this.particles.visible && pType) {
      this.pUniforms.uTime.value = t;
      const pos = this.particles.geometry.attributes.position;

      if (pType === 'vuurvliegjes') {
        this.pUniforms.uColor.value.copy(this.live.accentColor).lerp(new THREE.Color('#ffd88a'), 0.5);
        this.pUniforms.uOpacity.value = 0.95;
        this.pUniforms.uTwinkle.value = 1.0;
        this.pUniforms.uSizeScale.value = 1.15;
        for (let i = 0; i < this.particleCount; i++) {
          const s = this.pSeeds[i * 2];
          const sp = this.pSeeds[i * 2 + 1];
          this.pPositions[i * 3] += Math.sin(t * 0.45 * sp + s) * dt * 0.24;
          this.pPositions[i * 3 + 1] += Math.cos(t * 0.6 * sp + s) * dt * 0.13;
          this.pPositions[i * 3 + 2] += Math.cos(t * 0.42 * sp + s) * dt * 0.24;
          if (this.pPositions[i * 3 + 1] < 0.25) this.pPositions[i * 3 + 1] = 0.3;
          if (this.pPositions[i * 3 + 1] > 4.6) this.pPositions[i * 3 + 1] = 4.5;
        }
        pos.needsUpdate = true;
      } else if (pType === 'sneeuw') {
        this.pUniforms.uColor.value.set('#e8f2fc');
        this.pUniforms.uOpacity.value = 0.78;
        this.pUniforms.uTwinkle.value = 0.2;
        this.pUniforms.uSizeScale.value = 0.85;
        for (let i = 0; i < this.particleCount; i++) {
          const s = this.pSeeds[i * 2];
          this.pPositions[i * 3] += Math.sin(t * 0.65 + s) * dt * 0.18;
          this.pPositions[i * 3 + 1] -= dt * (0.35 + this.pSeeds[i * 2 + 1] * 0.28);
          if (this.pPositions[i * 3 + 1] < 0.05) this._resetParticle(i, false);
        }
        pos.needsUpdate = true;
      } else if (pType === 'stof') {
        this.pUniforms.uColor.value.copy(this.live.lightColor);
        this.pUniforms.uOpacity.value = 0.52;
        this.pUniforms.uTwinkle.value = 0.55;
        this.pUniforms.uSizeScale.value = 0.68;
        for (let i = 0; i < this.particleCount; i++) {
          const s = this.pSeeds[i * 2];
          this.pPositions[i * 3] += Math.sin(t * 0.22 + s) * dt * 0.06;
          this.pPositions[i * 3 + 1] += Math.cos(t * 0.28 + s) * dt * 0.04;
        }
        pos.needsUpdate = true;
      } else if (pType === 'sterren') {
        this.pUniforms.uColor.value.set('#f4efe6');
        this.pUniforms.uOpacity.value = 0.92;
        this.pUniforms.uTwinkle.value = 0.9;
        this.pUniforms.uSizeScale.value = 2.6;
        this.particles.rotation.y = t * 0.008;
      }

      if (pType !== 'sterren') this.particles.rotation.y = 0;
    }
  }
}
