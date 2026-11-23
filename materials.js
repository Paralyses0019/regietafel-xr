// Procedurele PBR-texturen (steen, hout, beton), PMREM-omgevingslicht en zachte volumetrische lichtkernen
import * as THREE from 'three';

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Naadloos herhalende (tileable) vloeiende value-noise op een [0..period) grid
function tileNoise(u, v, period, seed = 0) {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x) % period;
  const y0 = Math.floor(y) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0 + seed * 31, y0 + seed * 17);
  const b = hash2(x1 + seed * 31, y0 + seed * 17);
  const c = hash2(x0 + seed * 31, y1 + seed * 17);
  const d = hash2(x1 + seed * 31, y1 + seed * 17);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

// 1. Organische donkere natte leisteen/aarde-textuur (naadloze FBM-ruis, géén herhalende stippen!)
export function createStoneTextures() {
  const size = 256;
  const diffC = makeCanvas(size);
  const roughC = makeCanvas(size);
  const bumpC = makeCanvas(size);
  const dCtx = diffC.getContext('2d');
  const rCtx = roughC.getContext('2d');
  const bCtx = bumpC.getContext('2d');

  const dImg = dCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = (y * size + x) * 4;
      const n1 = tileNoise(u, v, 4, 1);
      const n2 = tileNoise(u, v, 8, 2);
      const n3 = tileNoise(u, v, 16, 3);
      const n4 = tileNoise(u, v, 32, 4);
      const fbm = n1 * 0.45 + n2 * 0.28 + n3 * 0.17 + n4 * 0.10;
      const damp = Math.max(0, (fbm - 0.56) * 2.2);

      const base = 22 + fbm * 22 - damp * 7;
      dImg.data[idx] = base * 0.96;
      dImg.data[idx + 1] = base * 0.98;
      dImg.data[idx + 2] = base * 1.03;
      dImg.data[idx + 3] = 255;

      // Subtiele vochtigheidsvariatie zonder harde glansvlekken
      const rough = Math.max(92, Math.min(242, 224 - damp * 105 + (n4 - 0.5) * 24));
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;

      const bump = Math.max(0, Math.min(255, (n2 * 0.4 + n3 * 0.35 + n4 * 0.25) * 230));
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bump;
      bImg.data[idx + 3] = 255;
    }
  }

  dCtx.putImageData(dImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const wrap = (c, repeat, isColor = false) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    if (isColor) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  return {
    map: wrap(diffC, 7, true),
    roughnessMap: wrap(roughC, 7, false),
    bumpMap: wrap(bumpC, 7, false)
  };
}

// 1b. Geweven linnen tentdoek-textuur met subtiele vezels en zachte vignettering
export function createLinenTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8b498';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < size; i += 2) {
    const a = 0.05 + hash2(i, 3) * 0.06;
    ctx.fillStyle = `rgba(38, 28, 20, ${a})`;
    ctx.fillRect(0, i, size, 1);
    ctx.fillRect(i, 0, 1, size);
  }
  const vig = ctx.createRadialGradient(128, 128, 20, 128, 128, 175);
  vig.addColorStop(0, 'rgba(255, 240, 212, 0.16)');
  vig.addColorStop(1, 'rgba(20, 14, 10, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 1c. Radiale kolen/as-textuur voor het kampvuurbed (heet oranje in het midden, zwart verkoold aan de rand)
export function createEmberBedTexture() {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#090706';
  ctx.fillRect(0, 0, size, size);

  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 58);
  g.addColorStop(0.0, 'rgba(255, 196, 110, 0.95)');
  g.addColorStop(0.28, 'rgba(225, 86, 24, 0.72)');
  g.addColorStop(0.58, 'rgba(65, 22, 10, 0.35)');
  g.addColorStop(1.0, 'rgba(10, 8, 7, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Kolen-korrels
  for (let i = 0; i < 90; i++) {
    const ang = hash2(i, 1) * Math.PI * 2;
    const rad = hash2(i, 2) * 44;
    const x = 64 + Math.cos(ang) * rad;
    const y = 64 + Math.sin(ang) * rad;
    const hot = rad < 26 && hash2(i, 3) > 0.45;
    ctx.fillStyle = hot ? 'rgba(255, 145, 50, 0.75)' : 'rgba(16, 12, 10, 0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 2 + hash2(i, 4) * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 2. Verweerd donker hout (planken voor vlonder & paviljoen)
export function createWoodTextures() {
  const size = 256;
  const c = makeCanvas(size);
  const b = makeCanvas(size);
  const ctx = c.getContext('2d');
  const bCtx = b.getContext('2d');

  ctx.fillStyle = '#3b2d23';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const planks = 8;
  const ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    const tone = 44 + ((p * 17) % 18);
    ctx.fillStyle = `rgb(${tone + 14}, ${tone + 2}, ${tone - 8})`;
    ctx.fillRect(0, y0, size, ph - 2);

    // Nerven
    for (let g = 0; g < 18; g++) {
      const gy = y0 + hash2(p, g) * (ph - 3);
      ctx.fillStyle = g % 2 === 0 ? 'rgba(18,12,8,0.22)' : 'rgba(140,110,85,0.12)';
      ctx.fillRect(0, gy, size, 1.5);
      bCtx.fillStyle = g % 2 === 0 ? 'rgba(40,40,40,0.4)' : 'rgba(200,200,200,0.25)';
      bCtx.fillRect(0, gy, size, 1.5);
    }

    // Voeg tussen planken
    ctx.fillStyle = '#140f0c';
    ctx.fillRect(0, y0 + ph - 2, size, 2);
    bCtx.fillStyle = '#080808';
    bCtx.fillRect(0, y0 + ph - 2, size, 2);
  }

  const wrap = (canvas, isColor = false) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    if (isColor) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: wrap(c, true), bumpMap: wrap(b, false) };
}

// 3. Architectonisch ruw beton voor monolieten & poorten
export function createConcreteTextures() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = hash2(Math.floor(x / 4), Math.floor(y / 4)) * 0.55 + hash2(x, y) * 0.45;
      const seam = (y % 64 === 0) ? -14 : 0;
      const v = Math.max(18, Math.min(220, 56 + n * 28 + seam));
      img.data[i] = v * 0.98;
      img.data[i + 1] = v * 0.98;
      img.data[i + 2] = v * 1.02;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 4. Zachte radiale lichtgloed-textuur voor meerlaagse volumetrische gloed (zoals warmCore in zintuigen-vr)
let sharedGlowTex = null;
export function getGlowTexture() {
  if (sharedGlowTex) return sharedGlowTex;
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.14, 'rgba(255,255,255,0.82)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.04)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  sharedGlowTex = new THREE.CanvasTexture(c);
  sharedGlowTex.colorSpace = THREE.SRGBColorSpace;
  return sharedGlowTex;
}

// Bouwt een rijke meerlaagse additieve lichtkern (ziet eruit als echte volumetrische gloed zonder bloom-postprocessing)
export function createGlowCore(colorHex, scale = 1.0) {
  const group = new THREE.Group();
  const tex = getGlowTexture();
  const base = new THREE.Color(colorHex || '#f4b56a');
  const hot = base.clone().lerp(new THREE.Color('#fff7e8'), 0.72);
  const deep = base.clone().multiplyScalar(0.85);

  const layers = [
    { size: 1.9 * scale, col: deep, opacity: 0.16 },
    { size: 1.05 * scale, col: base, opacity: 0.34 },
    { size: 0.44 * scale, col: hot, opacity: 0.78 },
    { size: 0.16 * scale, col: new THREE.Color('#ffffff'), opacity: 0.96 }
  ];

  const sprites = layers.map(l => {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: l.col,
      transparent: true,
      opacity: l.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(l.size, l.size, 1);
    group.add(sp);
    return { sp, mat, baseSize: l.size, baseOpacity: l.opacity };
  });

  group.userData.setGlowColor = (hex) => {
    const c = new THREE.Color(hex);
    const h = c.clone().lerp(new THREE.Color('#fff7e8'), 0.72);
    const d = c.clone().multiplyScalar(0.85);
    sprites[0].mat.color.copy(d);
    sprites[1].mat.color.copy(c);
    sprites[2].mat.color.copy(h);
  };
  group.userData.glowSprites = sprites;
  return group;
}

// 5. Subtiele PMREM omgevingsreflectie (geeft nat steen, water en metaal direct diepte)
export function createStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0c1016);

  const skyBand = new THREE.Mesh(
    new THREE.SphereGeometry(20, 24, 14),
    new THREE.MeshBasicMaterial({ color: 0x1e2633, side: THREE.BackSide })
  );
  envScene.add(skyBand);

  const warmPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe0b5, side: THREE.DoubleSide })
  );
  warmPanel.position.set(6, 7, -8);
  warmPanel.lookAt(0, 0, 0);
  envScene.add(warmPanel);

  const coolPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 6),
    new THREE.MeshBasicMaterial({ color: 0x7ba7d4, side: THREE.DoubleSide })
  );
  coolPanel.position.set(-7, 6, 8);
  coolPanel.lookAt(0, 0, 0);
  envScene.add(coolPanel);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}
