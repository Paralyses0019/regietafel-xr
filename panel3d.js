// Zwevend 3D-regiepaneel (high-DPI CanvasTexture + UV hit-testing) voor VR, MR en Desktop
import * as THREE from 'three';
import {
  ENVIRONMENTS, COLORS, PARTICLES, AMBIENCE_ITEMS, SOUND_TYPES,
  PROP_TYPES, PROP_COLORS, PRESETS, MAX_PROPS, MAX_SOUNDS,
  getActiveCue, getEnabledCues
} from './state.js';

const W = 1280;
const H = 860;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Panel3D {
  constructor(scene, callbacks) {
    this.scene = scene;
    this.cb = callbacks;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    // Hoofdpaneel (Build + Ready + Done)
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.16, 1.16 * (H / W)),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, side: THREE.DoubleSide })
    );
    this.mesh.userData = { isPanel: true };
    this.root.add(this.mesh);

    // Mini "Toon paneel" / "Stop" knop onderaan als het paneel is ingeklapt of tijdens Play
    this.pillCanvas = document.createElement('canvas');
    this.pillCanvas.width = 420;
    this.pillCanvas.height = 110;
    this.pillCtx = this.pillCanvas.getContext('2d');
    this.pillTex = new THREE.CanvasTexture(this.pillCanvas);
    this.pillTex.colorSpace = THREE.SRGBColorSpace;

    this.pillMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.11),
      new THREE.MeshBasicMaterial({ map: this.pillTex, transparent: true, side: THREE.DoubleSide })
    );
    this.pillMesh.userData = { isPill: true };
    this.pillMesh.position.set(0, 0.42, -1.15);
    this.pillMesh.rotation.x = -0.55;
    this.pillMesh.visible = false;
    this.scene.add(this.pillMesh);

    this.hitBoxes = [];
    this.hoverId = null;
    this.hoverUV = null;
    this.activeSlider = null;
    this.hidden = false;
    this.isAR = false;
    this.lastState = null;
    this.playInfo = null;

    this._tmpPos = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();

    this.placeInFrontOf(new THREE.Vector3(0, 1.55, 0), new THREE.Vector3(0, 0, -1));
  }

  placeInFrontOf(originPos, forwardDir, distance = 1.32) {
    const dir = forwardDir.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
    dir.normalize();

    this.root.position.set(
      originPos.x + dir.x * distance,
      Math.max(1.05, originPos.y - 0.18),
      originPos.z + dir.z * distance
    );
    this.root.lookAt(originPos.x, originPos.y - 0.06, originPos.z);

    // Zet ook de mini-pill netjes laag voor de speler
    this.pillMesh.position.set(
      originPos.x + dir.x * 1.15,
      Math.max(0.35, originPos.y - 0.95),
      originPos.z + dir.z * 1.15
    );
    this.pillMesh.lookAt(originPos.x, originPos.y, originPos.z);
  }

  recenterToCamera(camera) {
    camera.getWorldPosition(this._tmpPos);
    camera.getWorldDirection(this._tmpDir);
    this.placeInFrontOf(this._tmpPos, this._tmpDir, 1.32);
  }

  setHidden(hidden, state) {
    this.hidden = hidden;
    this.render(state, this.playInfo);
  }

  getInteractiveMeshes() {
    const list = [];
    if (this.mesh.visible) list.push(this.mesh);
    if (this.pillMesh.visible) list.push(this.pillMesh);
    return list;
  }

  _drawPill(text, accent = false) {
    const ctx = this.pillCtx;
    ctx.clearRect(0, 0, 420, 110);
    roundRect(ctx, 8, 8, 404, 94, 47);
    ctx.fillStyle = accent ? 'rgba(18, 28, 36, 0.88)' : 'rgba(14, 20, 28, 0.72)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = accent ? '#2bb3a3' : 'rgba(255,255,255,0.28)';
    ctx.stroke();

    ctx.fillStyle = '#eef4fa';
    ctx.font = '700 30px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 210, 56);
    this.pillTex.needsUpdate = true;
  }

  render(state, playInfo = null) {
    this.lastState = state;
    this.playInfo = playInfo;
    this.hitBoxes = [];

    if (state.mode === 'playing') {
      this.mesh.visible = false;
      this.pillMesh.visible = true;
      const cueLabel = playInfo ? `Moment ${playInfo.step}/${playInfo.total} · Stop` : 'Stop ervaring';
      this._drawPill(cueLabel, false);
      return;
    }

    if (state.mode === 'build' && this.hidden) {
      this.mesh.visible = false;
      this.pillMesh.visible = true;
      this._drawPill('Toon regietafel', true);
      return;
    }

    this.mesh.visible = true;
    this.pillMesh.visible = false;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    if (state.mode === 'ready' || state.mode === 'done') {
      this._renderPlayCard(ctx, state);
      this._drawCursor(ctx);
      this.texture.needsUpdate = true;
      return;
    }

    // Build mode: groot regiepaneel
    roundRect(ctx, 10, 10, W - 20, H - 20, 28);
    ctx.fillStyle = 'rgba(12, 18, 25, 0.94)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();

    this._renderHeader(ctx, state);

    const cue = getActiveCue(state);
    if (state.activeTab === 'sfeer') {
      this._renderTabSfeer(ctx, state, cue);
    } else if (state.activeTab === 'geluid') {
      this._renderTabGeluid(ctx, state, cue);
    } else {
      this._renderTabBouwen(ctx, state, cue);
    }

    this._renderCueBar(ctx, state, cue);
    this._drawCursor(ctx);
    this.texture.needsUpdate = true;
  }

  _addButton(ctx, id, x, y, w, h, label, opts = {}) {
    const hovered = this.hoverId === id;
    const active = !!opts.active;
    const disabled = !!opts.disabled;
    const radius = opts.radius ?? 14;

    roundRect(ctx, x, y, w, h, radius);
    if (opts.fill) {
      ctx.fillStyle = opts.fill;
    } else if (opts.primary) {
      ctx.fillStyle = hovered ? '#37ccb9' : '#2bb3a3';
    } else if (opts.danger) {
      ctx.fillStyle = hovered ? 'rgba(239,106,99,0.45)' : 'rgba(239,106,99,0.22)';
    } else if (active) {
      ctx.fillStyle = 'rgba(43, 179, 163, 0.28)';
    } else {
      ctx.fillStyle = hovered ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.06)';
    }
    ctx.fill();

    ctx.lineWidth = active || hovered ? 2.5 : 1.5;
    ctx.strokeStyle = opts.primary
      ? '#66e4d5'
      : active
        ? '#2bb3a3'
        : hovered
          ? 'rgba(255,255,255,0.45)'
          : 'rgba(255,255,255,0.12)';
    ctx.stroke();

    if (opts.swatch) {
      ctx.beginPath();
      ctx.arc(x + (label ? 26 : w / 2), y + h / 2, label ? 12 : 16, 0, Math.PI * 2);
      ctx.fillStyle = opts.swatch;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.stroke();
    }

    if (label) {
      ctx.fillStyle = disabled
        ? 'rgba(255,255,255,0.32)'
        : opts.primary
          ? '#041917'
          : '#eef4fa';
      ctx.font = `${opts.bold !== false ? '700' : '600'} ${opts.fontSize ?? 22}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
      ctx.textAlign = opts.swatch ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, opts.swatch ? x + 48 : x + w / 2, y + h / 2 + 1);
    }

    if (!disabled && opts.onClick) {
      this.hitBoxes.push({ id, x, y, w, h, type: 'button', onClick: opts.onClick });
    }
  }

  _addSlider(ctx, id, x, y, w, h, label, value, colorHex, onChange) {
    const hovered = this.hoverId === id || this.activeSlider?.id === id;
    const clamped = Math.max(0, Math.min(1, value ?? 0));

    // Label + %
    ctx.fillStyle = '#c8d4e0';
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y);

    ctx.fillStyle = '#eef4fa';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(clamped * 100)}%`, x + w, y);

    const trackY = y + 32;
    const trackH = h - 32;
    roundRect(ctx, x, trackY, w, trackH, trackH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    ctx.strokeStyle = hovered ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.14)';
    ctx.stroke();

    const fillW = Math.max(trackH, clamped * w);
    roundRect(ctx, x, trackY, fillW, trackH, trackH / 2);
    ctx.fillStyle = colorHex || '#2bb3a3';
    ctx.fill();

    // Knopje
    const knobX = x + clamped * (w - trackH) + trackH / 2;
    ctx.beginPath();
    ctx.arc(knobX, trackY + trackH / 2, trackH * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    this.hitBoxes.push({
      id,
      x: x - 8,
      y: trackY - 10,
      w: w + 16,
      h: trackH + 20,
      trackX: x,
      trackW: w,
      type: 'slider',
      onChange
    });
  }

  _renderHeader(ctx, state) {
    // Tabs
    const tabs = [
      { id: 'sfeer', label: '1 · Sfeer' },
      { id: 'geluid', label: '2 · Geluid' },
      { id: 'bouwen', label: '3 · Bouwen (Plus)' }
    ];
    let tx = 36;
    tabs.forEach(t => {
      const tw = t.id === 'bouwen' ? 215 : 155;
      this._addButton(ctx, `tab_${t.id}`, tx, 30, tw, 58, t.label, {
        active: state.activeTab === t.id,
        fontSize: 21,
        onClick: () => this.cb.setTab(t.id)
      });
      tx += tw + 12;
    });

    // Presets
    ctx.fillStyle = '#8fa0b2';
    ctx.font = '600 15px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('VOORBEELD:', 605, 18);

    const presetKeys = ['schuilplek', 'spanning', 'lokaal'];
    const presetLabels = ['Schuilplek', 'Spanning', 'MR'];
    let px = 605;
    presetKeys.forEach((pk, idx) => {
      const pw = idx === 2 ? 64 : 112;
      this._addButton(ctx, `preset_${pk}`, px, 40, pw, 48, presetLabels[idx], {
        fontSize: 17,
        onClick: () => this.cb.loadPreset(pk)
      });
      px += pw + 8;
    });

    // Verberg + Doorgeven
    this._addButton(ctx, 'btn_hide', 926, 30, 108, 58, 'Verberg', {
      fontSize: 19,
      onClick: () => this.cb.toggleHide()
    });
    this._addButton(ctx, 'btn_ready', 1044, 30, 202, 58, '▶ Doorgeven', {
      primary: true,
      fontSize: 22,
      onClick: () => this.cb.enterReady()
    });

    // Scheidingslijn
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 106);
    ctx.lineTo(W - 32, 106);
    ctx.stroke();
  }

  _renderTabSfeer(ctx, state, cue) {
    // 1. Basisruimte
    ctx.fillStyle = '#9db0c4';
    ctx.font = '700 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      this.isAR ? 'BASISRUIMTE (MR-PASSTHROUGH ACTIEF — JE ZIET HET ECHTE LOKAAL)' : 'BASISRUIMTE (VR)',
      40, 126
    );

    ENVIRONMENTS.forEach((env, idx) => {
      const bw = 285;
      const bx = 40 + idx * (bw + 16);
      this._addButton(ctx, `env_${env.id}`, bx, 156, bw, 58, env.label, {
        active: !this.isAR && cue.env === env.id,
        disabled: this.isAR,
        fontSize: 22,
        onClick: () => this.cb.updateCue({ env: env.id })
      });
    });

    // 2. Licht & Kleur
    ctx.fillStyle = '#9db0c4';
    ctx.font = '700 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText('LICHT & SFEERKLEUR', 40, 236);

    COLORS.forEach((col, idx) => {
      const bw = 188;
      const bx = 40 + idx * (bw + 14);
      this._addButton(ctx, `col_${col.id}`, bx, 266, bw, 58, col.label.split(' ')[0], {
        active: cue.color === col.id,
        swatch: col.hex,
        fontSize: 20,
        onClick: () => this.cb.updateCue({ color: col.id })
      });
    });

    // 3. Sliders (Helderheid, Mist, Puls)
    const activeCol = COLORS.find(c => c.id === cue.color)?.hex || '#2bb3a3';
    this._addSlider(ctx, 'sl_bright', 40, 352, 372, 68, 'Helderheid', cue.brightness, activeCol,
      v => this.cb.updateCue({ brightness: v }, true));
    this._addSlider(ctx, 'sl_fog', 450, 352, 372, 68, this.isAR ? 'Mist (alleen in VR)' : 'Mistdichtheid', cue.fog, '#88b4d8',
      v => this.cb.updateCue({ fog: v }, true));
    this._addSlider(ctx, 'sl_pulse', 860, 352, 380, 68, 'Ademing / Puls', cue.pulse, '#f2b66d',
      v => this.cb.updateCue({ pulse: v }, true));

    // 4. Deeltjes
    ctx.fillStyle = '#9db0c4';
    ctx.font = '700 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('DEELTJES IN DE LUCHT', 40, 452);

    PARTICLES.forEach((p, idx) => {
      const bw = 188;
      const bx = 40 + idx * (bw + 14);
      this._addButton(ctx, `part_${p.id}`, bx, 482, bw, 62, p.label, {
        active: cue.particles === p.id,
        fontSize: 21,
        onClick: () => this.cb.updateCue({ particles: p.id })
      });
    });

    // Tip-balk
    roundRect(ctx, 40, 574, W - 80, 62, 14);
    ctx.fillStyle = 'rgba(43,179,163,0.1)';
    ctx.fill();
    ctx.fillStyle = '#bfe8e2';
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tip: test het verschil tussen Direct en Fade 4s onderaan — dat is het verschil tussen schrikken en Comfort.', 62, 606);
  }

  _renderTabGeluid(ctx, state, cue) {
    // Linkerkolom: 6 Sfeerlagen
    ctx.fillStyle = '#9db0c4';
    ctx.font = '700 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SFEERLAGEN (MIX ER 1 OF 2)', 40, 126);

    this._addButton(ctx, 'btn_silence', 462, 118, 150, 42, 'Alles stil', {
      fontSize: 18,
      onClick: () => this.cb.clearAmbience()
    });

    AMBIENCE_ITEMS.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const sx = 40 + col * 294;
      const sy = 176 + row * 112;
      this._addSlider(
        ctx,
        `amb_${item.id}`,
        sx, sy, 274, 72,
        item.label,
        cue.ambience?.[item.id] ?? 0,
        idx >= 4 ? '#ef6a63' : '#2bb3a3',
        v => this.cb.updateAmbience(item.id, v)
      );
    });

    // Scheidingslijn midden
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(646, 124);
    ctx.lineTo(646, 650);
    ctx.stroke();

    // Rechterkolom: 3D-geluidsbronnen plaatsen
    ctx.fillStyle = '#9db0c4';
    ctx.font = '700 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const sndCount = (cue.sounds || []).length;
    ctx.fillText(`3D-GELUID IN DE RUIMTE (${sndCount}/${MAX_SOUNDS})`, 676, 126);

    SOUND_TYPES.forEach((st, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = 676 + col * 288;
      const by = 160 + row * 72;
      this._addButton(ctx, `add_snd_${st.id}`, bx, by, 274, 58, `+ ${st.label}`, {
        swatch: st.color,
        disabled: sndCount >= MAX_SOUNDS,
        fontSize: 20,
        onClick: () => this.cb.spawnSound(st.id)
      });
    });

    // Inspector voor geselecteerde 3D-geluidsbron
    const selected = (cue.sounds || []).find(s => s.id === state.selectedObjectId)
      || (cue.sounds && cue.sounds[cue.sounds.length - 1]);

    roundRect(ctx, 676, 326, 562, 314, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (selected) {
      const meta = SOUND_TYPES.find(s => s.id === selected.type) || SOUND_TYPES[0];
      ctx.fillStyle = '#eef4fa';
      ctx.font = '700 22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Geselecteerd: ${meta.label}`, 700, 346);

      ctx.fillStyle = '#9db0c4';
      ctx.font = '600 17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Zet snel op een richting (of sleep de bol in 3D):', 700, 382);

      const dirs = [
        { id: 'voor', label: 'Voor', x: 0, z: -2.4 },
        { id: 'links', label: 'Links', x: -2.4, z: 0 },
        { id: 'rechts', label: 'Rechts', x: 2.4, z: 0 },
        { id: 'achter', label: 'Achter je!', x: 0, z: 2.4 }
      ];
      dirs.forEach((d, idx) => {
        this._addButton(ctx, `snd_dir_${d.id}`, 700 + idx * 130, 416, 120, 56, d.label, {
          fontSize: 19,
          onClick: () => this.cb.moveSoundRelative(selected.id, d.x, d.z)
        });
      });

      this._addSlider(ctx, 'sl_snd_vol', 700, 492, 514, 62, 'Volume van deze bron', selected.volume ?? 0.8, meta.color,
        v => this.cb.updateSound(selected.id, { volume: v }));

      this._addButton(ctx, 'snd_test', 700, 570, 246, 52, '▶ Test geluid nu', {
        primary: true,
        fontSize: 20,
        onClick: () => this.cb.testSound(selected.id)
      });
      this._addButton(ctx, 'snd_del', 964, 570, 250, 52, '✕ Verwijder bron', {
        danger: true,
        fontSize: 20,
        onClick: () => this.cb.deleteSelected(selected.id, 'sound')
      });
    } else {
      ctx.fillStyle = '#9db0c4';
      ctx.font = '600 21px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Klik hierboven op een 3D-geluid om het te plaatsen.', 957, 456);
      ctx.font = '500 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillStyle = '#7e90a4';
      ctx.fillText('In Play-modus is de bol onzichtbaar — je hoort alleen de richting.', 957, 494);
    }
  }

  _renderTabBouwen(ctx, state, cue) {
    const count = (cue.props || []).length;
    ctx.fillStyle = '#9db0c4';
    ctx.font = '700 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`KIJK ERGENS HEEN EN PLAATS EEN ELEMENT (${count}/${MAX_PROPS})`, 40, 126);

    if (count > 0) {
      this._addButton(ctx, 'btn_clear_props', W - 210, 118, 170, 42, 'Wis alle objecten', {
        danger: true,
        fontSize: 17,
        onClick: () => this.cb.clearProps()
      });
    }

    PROP_TYPES.forEach((pt, idx) => {
      const bw = 188;
      const bx = 40 + idx * (bw + 14);
      this._addButton(ctx, `add_prop_${pt.id}`, bx, 168, bw, 66, `+ ${pt.label}`, {
        disabled: count >= MAX_PROPS,
        fontSize: 20,
        onClick: () => this.cb.spawnProp(pt.id)
      });
    });

    // Inspector box voor geselecteerd 3D-object
    const selected = (cue.props || []).find(p => p.id === state.selectedObjectId)
      || (cue.props && cue.props[cue.props.length - 1]);

    roundRect(ctx, 40, 260, W - 80, 380, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (selected) {
      const meta = PROP_TYPES.find(p => p.id === selected.type) || PROP_TYPES[0];
      ctx.fillStyle = '#eef4fa';
      ctx.font = '700 24px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Geselecteerd object: ${meta.label}`, 68, 286);

      ctx.fillStyle = '#8fa0b2';
      ctx.font = '600 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Tip: wijs naar een object in 3D en sleep om het vrij te verplaatsen.', 480, 290);

      // Grootte (S / M / L)
      ctx.fillStyle = '#9db0c4';
      ctx.font = '700 17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('GROOTTE', 68, 342);
      const sizes = [{ l: 'Klein (S)', v: 0.7 }, { l: 'Normaal (M)', v: 1.0 }, { l: 'Groot (L)', v: 1.45 }];
      sizes.forEach((sz, idx) => {
        this._addButton(ctx, `sz_${idx}`, 68 + idx * 144, 372, 134, 58, sz.l, {
          active: Math.abs((selected.scale || 1) - sz.v) < 0.15,
          fontSize: 19,
          onClick: () => this.cb.updateProp(selected.id, { scale: sz.v })
        });
      });

      // Afstand & draaien
      ctx.fillStyle = '#9db0c4';
      ctx.fillText('POSITIE & DRAAIEN', 534, 342);
      this._addButton(ctx, 'prop_near', 534, 372, 155, 58, 'Dichterbij', {
        fontSize: 19,
        onClick: () => this.cb.nudgePropDistance(selected.id, -0.55)
      });
      this._addButton(ctx, 'prop_far', 702, 372, 155, 58, 'Verder weg', {
        fontSize: 19,
        onClick: () => this.cb.nudgePropDistance(selected.id, 0.55)
      });
      this._addButton(ctx, 'prop_rotL', 874, 372, 82, 58, '↺', {
        fontSize: 26,
        onClick: () => this.cb.updateProp(selected.id, { rotY: (selected.rotY || 0) - 0.5 })
      });
      this._addButton(ctx, 'prop_rotR', 968, 372, 82, 58, '↻', {
        fontSize: 26,
        onClick: () => this.cb.updateProp(selected.id, { rotY: (selected.rotY || 0) + 0.5 })
      });
      this._addButton(ctx, 'prop_del', 1068, 372, 144, 58, '✕ Weg', {
        danger: true,
        fontSize: 20,
        onClick: () => this.cb.deleteSelected(selected.id, 'prop')
      });

      // Kleur / gloed
      ctx.fillStyle = '#9db0c4';
      ctx.font = '700 17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('KLEUR / GLOED VAN DIT OBJECT', 68, 462);
      PROP_COLORS.forEach((hex, idx) => {
        this._addButton(ctx, `pcol_${idx}`, 68 + idx * 110, 492, 96, 62, '', {
          swatch: hex,
          active: selected.color === hex,
          onClick: () => this.cb.updateProp(selected.id, { color: hex })
        });
      });

      // Volgende object kiezen (handig als je meerdere hebt)
      if (cue.props.length > 1) {
        this._addButton(ctx, 'prop_next', 840, 492, 372, 62, `Volgend object (${cue.props.indexOf(selected) + 1}/${cue.props.length}) →`, {
          fontSize: 19,
          onClick: () => this.cb.cycleSelectedProp()
        });
      }
    } else {
      ctx.fillStyle = '#eef4fa';
      ctx.font = '700 24px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Nog geen eigen objecten in dit moment.', W / 2, 420);
      ctx.fillStyle = '#8fa0b2';
      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Kijk ergens heen en klik hierboven op een element (bijv. + Kampvuur of + Zuil).', W / 2, 464);
    }
  }

  _renderCueBar(ctx, state, cue) {
    // Scheidingslijn
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 668);
    ctx.lineTo(W - 32, 668);
    ctx.stroke();

    ctx.fillStyle = '#9db0c4';
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('TIJDLIJN (MAX. 4 MOMENTEN)', 40, 682);

    // 4 Cue knoppen
    for (let i = 0; i < 4; i++) {
      const c = state.cues[i];
      const bx = 40 + i * 160;
      const label = c.enabled ? `Cue ${i + 1}` : `+ Cue ${i + 1}`;
      this._addButton(ctx, `cue_${i}`, bx, 712, 146, 68, label, {
        active: state.activeCueIndex === i,
        fontSize: 22,
        onClick: () => this.cb.selectCue(i)
      });
      // Uitschakel-kruisje op Cue 2..4 als actief
      if (i > 0 && c.enabled && state.activeCueIndex === i) {
        this._addButton(ctx, `cue_off_${i}`, bx + 106, 718, 34, 34, '×', {
          danger: true,
          radius: 10,
          fontSize: 20,
          onClick: () => this.cb.disableCue(i)
        });
      }
    }

    // Duur van actieve cue
    ctx.fillStyle = '#9db0c4';
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText('DUUR', 696, 682);
    [10, 18, 30].forEach((sec, idx) => {
      this._addButton(ctx, `dur_${sec}`, 696 + idx * 78, 712, 70, 68, `${sec}s`, {
        active: cue.duration === sec,
        fontSize: 20,
        onClick: () => this.cb.updateCue({ duration: sec })
      });
    });

    // Overgang (Direct vs Fade 4s)
    ctx.fillStyle = '#9db0c4';
    ctx.fillText('OVERGANG', 944, 682);
    this._addButton(ctx, 'tr_direct', 944, 712, 92, 68, 'Direct', {
      active: cue.transition <= 0.6,
      fontSize: 18,
      onClick: () => this.cb.updateCue({ transition: 0.4 })
    });
    this._addButton(ctx, 'tr_fade', 1044, 712, 102, 68, 'Fade 4s', {
      active: cue.transition > 0.6,
      fontSize: 18,
      onClick: () => this.cb.updateCue({ transition: 4.0 })
    });

    // Paneel voor je neus centreren
    this._addButton(ctx, 'btn_recenter', 1156, 712, 88, 68, '◎', {
      fontSize: 30,
      onClick: () => this.cb.recenterPanel()
    });

    // Statusregel helemaal onderaan
    const enabled = getEnabledCues(state);
    const totalSec = enabled.reduce((s, item) => s + item.cue.duration, 0);
    ctx.fillStyle = '#7e90a4';
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Actief: ${enabled.length} moment${enabled.length === 1 ? '' : 'en'} · totale speelduur ~${totalSec} sec · automatisch opgeslagen`, 40, 814);
  }

  _renderPlayCard(ctx, state) {
    const cx = W / 2;
    const cw = 820;
    const ch = 460;
    const x = cx - cw / 2;
    const y = H / 2 - ch / 2;

    roundRect(ctx, x, y, cw, ch, 34);
    ctx.fillStyle = 'rgba(11, 17, 24, 0.94)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(43, 179, 163, 0.55)';
    ctx.stroke();

    const enabled = getEnabledCues(state);
    const totalSec = enabled.reduce((s, item) => s + item.cue.duration, 0);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.mode === 'ready') {
      ctx.fillStyle = '#2bb3a3';
      ctx.font = '700 22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('KLAAR OM TE ERVAREN', cx, y + 66);

      ctx.fillStyle = '#eef4fa';
      ctx.font = '800 44px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Ga rustig staan en kijk om je heen.', cx, y + 132);

      ctx.fillStyle = '#99a9ba';
      ctx.font = '600 24px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(`${enabled.length} moment${enabled.length === 1 ? '' : 'en'} · ongeveer ${totalSec} seconden · til je handen eens op`, cx, y + 188);

      this._addButton(ctx, 'play_start', cx - 230, y + 240, 460, 96, '▶  START ERVARING', {
        primary: true,
        radius: 24,
        fontSize: 32,
        onClick: () => this.cb.startPlayback()
      });

      this._addButton(ctx, 'play_back', cx - 150, y + 362, 300, 56, '✎  Terug naar bouwen', {
        fontSize: 21,
        onClick: () => this.cb.backToBuild()
      });
    } else {
      ctx.fillStyle = '#f2b66d';
      ctx.font = '700 22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('EINDE VAN DE ERVARING', cx, y + 72);

      ctx.fillStyle = '#eef4fa';
      ctx.font = '800 42px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Hoe voelde dit voor jouw persona?', cx, y + 140);

      ctx.fillStyle = '#99a9ba';
      ctx.font = '600 22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Bespreek twee dingen: wat werkte goed, en wat kan rustiger of sterker?', cx, y + 196);

      this._addButton(ctx, 'done_replay', cx - 280, y + 266, 260, 86, '↻  Nog een keer', {
        primary: true,
        radius: 20,
        fontSize: 26,
        onClick: () => this.cb.startPlayback()
      });
      this._addButton(ctx, 'done_edit', cx + 20, y + 266, 260, 86, '✎  Aanpassen', {
        radius: 20,
        fontSize: 26,
        onClick: () => this.cb.backToBuild()
      });
    }
  }

  _drawCursor(ctx) {
    if (!this.hoverUV) return;
    const cx = this.hoverUV.x * W;
    const cy = (1 - this.hoverUV.y) * H;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2bb3a3';
    ctx.stroke();
  }

  _findHit(uv) {
    if (!uv) return null;
    const px = uv.x * W;
    const py = (1 - uv.y) * H;
    // Zoek van achter naar voren zodat bovenliggende knoppen (zoals × op Cue) voorrang krijgen
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const b = this.hitBoxes[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        return { box: b, px, py };
      }
    }
    return null;
  }

  handleHover(uv, isDragging) {
    const prevHover = this.hoverId;
    const hadUV = !!this.hoverUV;
    this.hoverUV = uv ? { x: uv.x, y: uv.y } : null;

    if (isDragging && this.activeSlider && uv) {
      const px = uv.x * W;
      const v = Math.max(0, Math.min(1, (px - this.activeSlider.trackX) / this.activeSlider.trackW));
      this.activeSlider.onChange(v);
      this.render(this.lastState, this.playInfo);
      return true;
    }

    const hit = this._findHit(uv);
    this.hoverId = hit ? hit.box.id : null;
    if (this.hoverId !== prevHover || !!uv !== hadUV || uv) {
      if (this.lastState) this.render(this.lastState, this.playInfo);
    }
    return !!hit;
  }

  handlePointerDown(uv, isPill = false) {
    if (isPill) {
      if (this.lastState?.mode === 'playing') {
        this.cb.stopPlayback();
      } else {
        this.cb.toggleHide();
      }
      return true;
    }
    const hit = this._findHit(uv);
    if (!hit) return false;
    if (hit.box.type === 'slider') {
      this.activeSlider = hit.box;
      const v = Math.max(0, Math.min(1, (hit.px - hit.box.trackX) / hit.box.trackW));
      hit.box.onChange(v);
      this.render(this.lastState, this.playInfo);
      return true;
    }
    if (hit.box.type === 'button' && hit.box.onClick) {
      hit.box.onClick();
      return true;
    }
    return false;
  }

  handlePointerUp() {
    this.activeSlider = null;
  }
}
