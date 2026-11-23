// Zwevende studio-regietafel v2 — architectonische lichtconsole in de stijl van zintuigen-vr
// (mat-zwart glas, haarlijnen, warm zand #e7d8be voor actieve keuzes, verfijnde faders, geen neon-clichés)
import * as THREE from 'three';
import {
  ENVIRONMENTS, COLORS, PARTICLES, AMBIENCE_ITEMS, SOUND_TYPES,
  PROP_TYPES, PROP_COLORS, MAX_PROPS, MAX_SOUNDS,
  getActiveCue, getEnabledCues
} from './state.js';

const W = 1280;
const H = 820;

const PAL = {
  bg: 'rgba(12, 14, 16, 0.90)',
  surface: 'rgba(255, 255, 255, 0.032)',
  surfaceHover: 'rgba(255, 255, 255, 0.085)',
  line: 'rgba(231, 216, 190, 0.16)',
  lineFaint: 'rgba(255, 255, 255, 0.08)',
  lineHover: 'rgba(231, 216, 190, 0.52)',
  sand: '#e7d8be',
  sandSoft: 'rgba(231, 216, 190, 0.14)',
  sandInk: '#111110',
  ink: '#f2eee6',
  muted: '#9b9386',
  dim: '#6e685e',
  danger: 'rgba(218, 102, 92, 0.22)',
  dangerLine: 'rgba(218, 102, 92, 0.55)'
};

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

function drawRect(ctx, x, y, w, h, r = 3) {
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

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 1.12 * (H / W)),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, side: THREE.DoubleSide })
    );
    this.mesh.userData = { isPanel: true };
    this.root.add(this.mesh);

    // Minimalistische lage zweef-balk voor Play-stop of Toon paneel
    this.pillCanvas = document.createElement('canvas');
    this.pillCanvas.width = 420;
    this.pillCanvas.height = 96;
    this.pillCtx = this.pillCanvas.getContext('2d');
    this.pillTex = new THREE.CanvasTexture(this.pillCanvas);
    this.pillTex.colorSpace = THREE.SRGBColorSpace;

    this.pillMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.40, 0.092),
      new THREE.MeshBasicMaterial({ map: this.pillTex, transparent: true, side: THREE.DoubleSide })
    );
    this.pillMesh.userData = { isPill: true };
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
      Math.max(1.02, originPos.y - 0.16),
      originPos.z + dir.z * distance
    );
    this.root.lookAt(originPos.x, originPos.y - 0.06, originPos.z);

    this.pillMesh.position.set(
      originPos.x + dir.x * 1.15,
      Math.max(0.34, originPos.y - 0.96),
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
    ctx.clearRect(0, 0, 420, 96);
    drawRect(ctx, 4, 4, 412, 88, 3);
    ctx.fillStyle = 'rgba(12, 14, 16, 0.86)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent ? PAL.sand : 'rgba(231, 216, 190, 0.35)';
    ctx.stroke();

    ctx.fillStyle = PAL.ink;
    ctx.font = `400 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 210, 49);
    this.pillTex.needsUpdate = true;
  }

  render(state, playInfo = null) {
    this.lastState = state;
    this.playInfo = playInfo;
    this.hitBoxes = [];

    if (state.mode === 'playing') {
      this.mesh.visible = false;
      this.pillMesh.visible = true;
      const lbl = playInfo ? `MOMENT ${playInfo.step} / ${playInfo.total}   ·   STOP` : 'STOP';
      this._drawPill(lbl, false);
      return;
    }

    if (state.mode === 'build' && this.hidden) {
      this.mesh.visible = false;
      this.pillMesh.visible = true;
      this._drawPill('REGIETAFEL TONEN', true);
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

    // Hoofdconsole: mat-zwart architectonisch kader
    drawRect(ctx, 2, 2, W - 4, H - 4, 4);
    ctx.fillStyle = PAL.bg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PAL.line;
    ctx.stroke();

    // Subtiele bovenste accentlijn
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(2, 2, W - 4, 2);

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

  _sectionLabel(ctx, text, x, y) {
    ctx.fillStyle = PAL.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
  }

  _btn(ctx, id, x, y, w, h, label, opts = {}) {
    const hovered = this.hoverId === id;
    const active = !!opts.active;
    const disabled = !!opts.disabled;

    drawRect(ctx, x, y, w, h, opts.radius ?? 3);
    if (opts.primary) {
      ctx.fillStyle = hovered ? '#f4e7cf' : PAL.sand;
    } else if (opts.danger) {
      ctx.fillStyle = hovered ? 'rgba(218,102,92,0.36)' : PAL.danger;
    } else if (active) {
      ctx.fillStyle = PAL.sand;
    } else {
      ctx.fillStyle = hovered ? PAL.surfaceHover : PAL.surface;
    }
    ctx.fill();

    ctx.lineWidth = hovered || active ? 1.8 : 1.2;
    ctx.strokeStyle = opts.primary || active
      ? PAL.sand
      : opts.danger
        ? PAL.dangerLine
        : hovered
          ? PAL.lineHover
          : PAL.line;
    ctx.stroke();

    if (opts.swatch) {
      const cx = label ? x + 24 : x + w / 2;
      ctx.beginPath();
      ctx.arc(cx, y + h / 2, label ? 9 : 13, 0, Math.PI * 2);
      ctx.fillStyle = opts.swatch;
      ctx.fill();
      if (active) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = PAL.sandInk;
        ctx.stroke();
      }
    }

    if (label) {
      ctx.fillStyle = disabled
        ? 'rgba(242,238,230,0.26)'
        : (opts.primary || active)
          ? PAL.sandInk
          : PAL.ink;
      ctx.font = `${(opts.primary || active) ? '500' : '400'} ${opts.fontSize ?? 19}px ${FONT}`;
      ctx.textAlign = opts.swatch ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, opts.swatch ? x + 44 : x + w / 2, y + h / 2 + 1);
    }

    if (!disabled && opts.onClick) {
      this.hitBoxes.push({ id, x, y, w, h, type: 'button', onClick: opts.onClick });
    }
  }

  // Verfijnde hardware-stijl fader (dunne rail + scherp schuifstreepje)
  _fader(ctx, id, x, y, w, h, label, value, accentHex, onChange) {
    const hovered = this.hoverId === id || this.activeSlider?.id === id;
    const v = Math.max(0, Math.min(1, value ?? 0));

    ctx.fillStyle = PAL.ink;
    ctx.font = `400 18px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y);

    ctx.fillStyle = hovered ? PAL.sand : PAL.muted;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(v * 100)}`, x + w, y);

    const railY = y + 40;
    // Achtergrondrail
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, railY - 2, w, 4);

    // Gevulde rail
    ctx.fillStyle = accentHex || PAL.sand;
    ctx.fillRect(x, railY - 2, Math.max(2, v * w), 4);

    // Fader-cap (strak verticaal blokje zoals een DMX-lichttafel)
    const capX = x + v * w;
    drawRect(ctx, capX - 7, railY - 14, 14, 28, 2);
    ctx.fillStyle = hovered ? '#ffffff' : PAL.sand;
    ctx.fill();

    this.hitBoxes.push({
      id,
      x: x - 10,
      y: railY - 22,
      w: w + 20,
      h: 44,
      trackX: x,
      trackW: w,
      type: 'slider',
      onChange
    });
  }

  _renderHeader(ctx, state) {
    // 3 schone tab-headers met actieve onderstreping
    const tabs = [
      { id: 'sfeer', label: '01  Sfeer' },
      { id: 'geluid', label: '02  Geluid' },
      { id: 'bouwen', label: '03  Bouwen' }
    ];
    let tx = 44;
    tabs.forEach(t => {
      const tw = 152;
      const active = state.activeTab === t.id;
      const hovered = this.hoverId === `tab_${t.id}`;
      ctx.fillStyle = active ? PAL.ink : hovered ? '#d6cfc4' : PAL.muted;
      ctx.font = `${active ? '500' : '400'} 21px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, tx, 50);

      if (active) {
        ctx.fillStyle = PAL.sand;
        ctx.fillRect(tx, 79, 108, 2.5);
      }
      this.hitBoxes.push({
        id: `tab_${t.id}`,
        x: tx - 8,
        y: 22,
        w: tw,
        h: 60,
        type: 'button',
        onClick: () => this.cb.setTab(t.id)
      });
      tx += tw + 16;
    });

    // Presets (discreet en strak)
    ctx.fillStyle = PAL.dim;
    ctx.font = `500 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', 596, 50);

    const presets = [
      { key: 'schuilplek', label: 'Schuilplek', w: 112 },
      { key: 'spanning', label: 'Spanning', w: 102 },
      { key: 'lokaal', label: 'MR', w: 58 }
    ];
    let px = 654;
    presets.forEach(p => {
      this._btn(ctx, `preset_${p.key}`, px, 29, p.w, 42, p.label, {
        fontSize: 16,
        onClick: () => this.cb.loadPreset(p.key)
      });
      px += p.w + 8;
    });

    // Verberg + Doorgeven
    this._btn(ctx, 'btn_hide', 964, 29, 98, 42, 'Verberg', {
      fontSize: 16,
      onClick: () => this.cb.toggleHide()
    });
    this._btn(ctx, 'btn_ready', 1072, 29, 166, 42, 'Doorgeven  →', {
      primary: true,
      fontSize: 17,
      onClick: () => this.cb.enterReady()
    });

    ctx.fillStyle = PAL.lineFaint;
    ctx.fillRect(40, 82, W - 80, 1);
  }

  _renderTabSfeer(ctx, state, cue) {
    this._sectionLabel(
      ctx,
      this.isAR ? 'RUIMTE   —   MIXED REALITY ACTIEF (EIGEN LOKAAL)' : 'BASISRUIMTE',
      44, 110
    );
    ENVIRONMENTS.forEach((env, idx) => {
      const bw = 285;
      this._btn(ctx, `env_${env.id}`, 44 + idx * (bw + 16), 138, bw, 54, env.label, {
        active: !this.isAR && cue.env === env.id,
        disabled: this.isAR,
        fontSize: 19,
        onClick: () => this.cb.updateCue({ env: env.id })
      });
    });

    this._sectionLabel(ctx, 'LICHT & SFEERKLEUR', 44, 222);
    COLORS.forEach((col, idx) => {
      const bw = 188;
      this._btn(ctx, `col_${col.id}`, 44 + idx * (bw + 13), 250, bw, 52, col.label.split(' ')[0], {
        active: cue.color === col.id,
        swatch: col.hex,
        fontSize: 18,
        onClick: () => this.cb.updateCue({ color: col.id })
      });
    });

    // Faders
    const activeHex = COLORS.find(c => c.id === cue.color)?.hex || PAL.sand;
    this._fader(ctx, 'sl_bright', 44, 340, 368, 64, 'Helderheid', cue.brightness, activeHex,
      v => this.cb.updateCue({ brightness: v }, true));
    this._fader(ctx, 'sl_fog', 456, 340, 368, 64, this.isAR ? 'Mist (alleen VR)' : 'Mist', cue.fog, PAL.sand,
      v => this.cb.updateCue({ fog: v }, true));
    this._fader(ctx, 'sl_pulse', 868, 340, 368, 64, 'Ademing / puls', cue.pulse, PAL.sand,
      v => this.cb.updateCue({ pulse: v }, true));

    this._sectionLabel(ctx, 'DEELTJES & WEER', 44, 444);
    PARTICLES.forEach((p, idx) => {
      const bw = 188;
      this._btn(ctx, `part_${p.id}`, 44 + idx * (bw + 13), 472, bw, 54, p.label, {
        active: cue.particles === p.id,
        fontSize: 18,
        onClick: () => this.cb.updateCue({ particles: p.id })
      });
    });

    // Rustige onderregel
    ctx.fillStyle = PAL.dim;
    ctx.font = `400 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tip: knijp op de grip-knop of tik op ◎ om het paneel weer recht voor je te plaatsen.', 44, 578);
  }

  _renderTabGeluid(ctx, state, cue) {
    this._sectionLabel(ctx, 'SFEERLAGEN (1 OF 2 MIXEN)', 44, 110);
    this._btn(ctx, 'btn_silence', 494, 102, 114, 34, 'Alles stil', {
      fontSize: 15,
      onClick: () => this.cb.clearAmbience()
    });

    AMBIENCE_ITEMS.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const sx = 44 + col * 292;
      const sy = 160 + row * 124;
      this._fader(
        ctx,
        `amb_${item.id}`,
        sx, sy, 266, 64,
        item.label,
        cue.ambience?.[item.id] ?? 0,
        idx >= 4 ? '#d98a7c' : PAL.sand,
        v => this.cb.updateAmbience(item.id, v)
      );
    });

    ctx.fillStyle = PAL.lineFaint;
    ctx.fillRect(640, 110, 1, 500);

    const sndCount = (cue.sounds || []).length;
    this._sectionLabel(ctx, `3D-GELUID IN DE RUIMTE  (${sndCount}/${MAX_SOUNDS})`, 674, 110);

    SOUND_TYPES.forEach((st, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      this._btn(ctx, `add_snd_${st.id}`, 674 + col * 288, 140 + row * 64, 274, 52, `+  ${st.label}`, {
        swatch: st.color,
        disabled: sndCount >= MAX_SOUNDS,
        fontSize: 18,
        onClick: () => this.cb.spawnSound(st.id)
      });
    });

    const selected = (cue.sounds || []).find(s => s.id === state.selectedObjectId)
      || (cue.sounds && cue.sounds[cue.sounds.length - 1]);

    drawRect(ctx, 674, 290, 562, 316, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.024)';
    ctx.fill();
    ctx.strokeStyle = PAL.lineFaint;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (selected) {
      const meta = SOUND_TYPES.find(s => s.id === selected.type) || SOUND_TYPES[0];
      ctx.fillStyle = PAL.ink;
      ctx.font = `400 22px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(meta.label, 700, 314);

      this._sectionLabel(ctx, 'RICHTING (OF SLEEP DE RING IN 3D)', 700, 352);
      const dirs = [
        { id: 'voor', label: 'Voor', x: 0, z: -2.5 },
        { id: 'links', label: 'Links', x: -2.5, z: 0 },
        { id: 'rechts', label: 'Rechts', x: 2.5, z: 0 },
        { id: 'achter', label: 'Achter je', x: 0, z: 2.5 }
      ];
      dirs.forEach((d, idx) => {
        this._btn(ctx, `snd_dir_${d.id}`, 700 + idx * 130, 378, 120, 48, d.label, {
          fontSize: 17,
          onClick: () => this.cb.moveSoundRelative(selected.id, d.x, d.z)
        });
      });

      this._fader(ctx, 'sl_snd_vol', 700, 452, 510, 58, 'Volume', selected.volume ?? 0.8, meta.color,
        v => this.cb.updateSound(selected.id, { volume: v }));

      this._btn(ctx, 'snd_test', 700, 536, 246, 48, 'Test geluid', {
        primary: true,
        fontSize: 18,
        onClick: () => this.cb.testSound(selected.id)
      });
      this._btn(ctx, 'snd_del', 962, 536, 248, 48, 'Verwijder', {
        danger: true,
        fontSize: 18,
        onClick: () => this.cb.deleteSelected(selected.id, 'sound')
      });
    } else {
      ctx.fillStyle = PAL.muted;
      ctx.font = `400 19px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Kies hierboven een 3D-geluid om het te plaatsen.', 955, 434);
      ctx.fillStyle = PAL.dim;
      ctx.font = `400 16px ${FONT}`;
      ctx.fillText('Tijdens Play is de ring onzichtbaar — je hoort alleen de richting.', 955, 470);
    }
  }

  _renderTabBouwen(ctx, state, cue) {
    const count = (cue.props || []).length;
    this._sectionLabel(ctx, `PLAATS ELEMENT WAAR JE KIJKT  (${count}/${MAX_PROPS})`, 44, 110);

    if (count > 0) {
      this._btn(ctx, 'btn_clear_props', W - 184, 102, 140, 34, 'Alles wissen', {
        danger: true,
        fontSize: 15,
        onClick: () => this.cb.clearProps()
      });
    }

    PROP_TYPES.forEach((pt, idx) => {
      const bw = 188;
      this._btn(ctx, `add_prop_${pt.id}`, 44 + idx * (bw + 13), 146, bw, 56, `+  ${pt.label}`, {
        disabled: count >= MAX_PROPS,
        fontSize: 18,
        onClick: () => this.cb.spawnProp(pt.id)
      });
    });

    const selected = (cue.props || []).find(p => p.id === state.selectedObjectId)
      || (cue.props && cue.props[cue.props.length - 1]);

    drawRect(ctx, 44, 232, W - 88, 374, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.024)';
    ctx.fill();
    ctx.strokeStyle = PAL.lineFaint;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (selected) {
      const meta = PROP_TYPES.find(p => p.id === selected.type) || PROP_TYPES[0];
      ctx.fillStyle = PAL.ink;
      ctx.font = `400 24px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(meta.label, 74, 260);

      ctx.fillStyle = PAL.dim;
      ctx.font = `400 16px ${FONT}`;
      ctx.fillText('Wijs in 3D op een object en sleep om het te verplaatsen.', 310, 266);

      this._sectionLabel(ctx, 'SCHAAL', 74, 316);
      const sizes = [{ l: 'Klein', v: 0.7 }, { l: 'Normaal', v: 1.0 }, { l: 'Groot', v: 1.45 }];
      sizes.forEach((sz, idx) => {
        this._btn(ctx, `sz_${idx}`, 74 + idx * 136, 344, 126, 52, sz.l, {
          active: Math.abs((selected.scale || 1) - sz.v) < 0.15,
          fontSize: 18,
          onClick: () => this.cb.updateProp(selected.id, { scale: sz.v })
        });
      });

      this._sectionLabel(ctx, 'AFSTAND & DRAAIEN', 518, 316);
      this._btn(ctx, 'prop_near', 518, 344, 148, 52, 'Dichterbij', {
        fontSize: 18,
        onClick: () => this.cb.nudgePropDistance(selected.id, -0.55)
      });
      this._btn(ctx, 'prop_far', 678, 344, 148, 52, 'Verder weg', {
        fontSize: 18,
        onClick: () => this.cb.nudgePropDistance(selected.id, 0.55)
      });
      this._btn(ctx, 'prop_rotL', 846, 344, 72, 52, '↺', {
        fontSize: 22,
        onClick: () => this.cb.updateProp(selected.id, { rotY: (selected.rotY || 0) - 0.5 })
      });
      this._btn(ctx, 'prop_rotR', 928, 344, 72, 52, '↻', {
        fontSize: 22,
        onClick: () => this.cb.updateProp(selected.id, { rotY: (selected.rotY || 0) + 0.5 })
      });
      this._btn(ctx, 'prop_del', 1020, 344, 186, 52, 'Verwijder', {
        danger: true,
        fontSize: 18,
        onClick: () => this.cb.deleteSelected(selected.id, 'prop')
      });

      this._sectionLabel(ctx, 'LICHTKLEUR / TINT', 74, 434);
      PROP_COLORS.forEach((hex, idx) => {
        this._btn(ctx, `pcol_${idx}`, 74 + idx * 96, 462, 84, 54, '', {
          swatch: hex,
          active: selected.color === hex,
          onClick: () => this.cb.updateProp(selected.id, { color: hex })
        });
      });

      if (cue.props.length > 1) {
        this._btn(ctx, 'prop_next', 846, 462, 360, 54, `Volgend object  (${cue.props.indexOf(selected) + 1}/${cue.props.length})  →`, {
          fontSize: 17,
          onClick: () => this.cb.cycleSelectedProp()
        });
      }
    } else {
      ctx.fillStyle = PAL.muted;
      ctx.font = `400 22px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Nog geen eigen elementen in dit moment.', W / 2, 404);
      ctx.fillStyle = PAL.dim;
      ctx.font = `400 17px ${FONT}`;
      ctx.fillText('Kijk ergens heen en klik hierboven op bijvoorbeeld + Kampvuur of + Lichtpoort.', W / 2, 444);
    }
  }

  _renderCueBar(ctx, state, cue) {
    ctx.fillStyle = PAL.lineFaint;
    ctx.fillRect(40, 636, W - 80, 1);

    this._sectionLabel(ctx, 'MOMENTEN (TIJDLIJN)', 44, 654);
    for (let i = 0; i < 4; i++) {
      const c = state.cues[i];
      const bx = 44 + i * 154;
      const label = c.enabled ? `0${i + 1}` : `+ 0${i + 1}`;
      this._btn(ctx, `cue_${i}`, bx, 682, 140, 60, label, {
        active: state.activeCueIndex === i,
        fontSize: 21,
        onClick: () => this.cb.selectCue(i)
      });
      if (i > 0 && c.enabled && state.activeCueIndex === i) {
        this._btn(ctx, `cue_off_${i}`, bx + 104, 688, 28, 28, '×', {
          danger: true,
          radius: 2,
          fontSize: 18,
          onClick: () => this.cb.disableCue(i)
        });
      }
    }

    this._sectionLabel(ctx, 'DUUR', 694, 654);
    [10, 18, 30].forEach((sec, idx) => {
      this._btn(ctx, `dur_${sec}`, 694 + idx * 74, 682, 66, 60, `${sec}s`, {
        active: cue.duration === sec,
        fontSize: 18,
        onClick: () => this.cb.updateCue({ duration: sec })
      });
    });

    this._sectionLabel(ctx, 'OVERGANG', 936, 654);
    this._btn(ctx, 'tr_direct', 936, 682, 92, 60, 'Direct', {
      active: cue.transition <= 0.6,
      fontSize: 17,
      onClick: () => this.cb.updateCue({ transition: 0.4 })
    });
    this._btn(ctx, 'tr_fade', 1036, 682, 102, 60, 'Fade 4s', {
      active: cue.transition > 0.6,
      fontSize: 17,
      onClick: () => this.cb.updateCue({ transition: 4.0 })
    });

    this._btn(ctx, 'btn_recenter', 1152, 682, 84, 60, '◎', {
      fontSize: 26,
      onClick: () => this.cb.recenterPanel()
    });

    const enabled = getEnabledCues(state);
    const totalSec = enabled.reduce((s, item) => s + item.cue.duration, 0);
    ctx.fillStyle = PAL.dim;
    ctx.font = `400 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${enabled.length} actief  ·  totaal ${totalSec} sec  ·  automatisch bewaard`, 44, 778);
  }

  _renderPlayCard(ctx, state) {
    const cx = W / 2;
    const cw = 760;
    const ch = 410;
    const x = cx - cw / 2;
    const y = H / 2 - ch / 2;

    drawRect(ctx, x, y, cw, ch, 4);
    ctx.fillStyle = 'rgba(12, 14, 16, 0.90)';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = PAL.line;
    ctx.stroke();

    ctx.fillStyle = PAL.sand;
    ctx.fillRect(x, y, cw, 2);

    const enabled = getEnabledCues(state);
    const totalSec = enabled.reduce((s, item) => s + item.cue.duration, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.mode === 'ready') {
      ctx.fillStyle = PAL.muted;
      ctx.font = `500 15px ${FONT}`;
      ctx.fillText('KLAAR OM TE ERVAREN', cx, y + 66);

      ctx.fillStyle = PAL.ink;
      ctx.font = `400 44px ${FONT}`;
      ctx.fillText('Ga rustig staan en kijk rond.', cx, y + 130);

      ctx.fillStyle = PAL.muted;
      ctx.font = `400 20px ${FONT}`;
      ctx.fillText(`${enabled.length} moment${enabled.length === 1 ? '' : 'en'}  ·  ${totalSec} seconden`, cx, y + 184);

      this._btn(ctx, 'play_start', cx - 190, y + 236, 380, 74, 'Start ervaring', {
        primary: true,
        fontSize: 25,
        onClick: () => this.cb.startPlayback()
      });
      this._btn(ctx, 'play_back', cx - 120, y + 332, 240, 44, 'Terug naar bouwen', {
        fontSize: 17,
        onClick: () => this.cb.backToBuild()
      });
    } else {
      ctx.fillStyle = PAL.muted;
      ctx.font = `500 15px ${FONT}`;
      ctx.fillText('EINDE', cx, y + 68);

      ctx.fillStyle = PAL.ink;
      ctx.font = `400 40px ${FONT}`;
      ctx.fillText('Wat voelde goed, en wat niet?', cx, y + 132);

      ctx.fillStyle = PAL.muted;
      ctx.font = `400 19px ${FONT}`;
      ctx.fillText('Bespreek één ding dat werkte en één ding dat rustiger kan.', cx, y + 186);

      this._btn(ctx, 'done_replay', cx - 250, y + 250, 236, 68, 'Nog een keer', {
        primary: true,
        fontSize: 22,
        onClick: () => this.cb.startPlayback()
      });
      this._btn(ctx, 'done_edit', cx + 14, y + 250, 236, 68, 'Aanpassen', {
        fontSize: 22,
        onClick: () => this.cb.backToBuild()
      });
    }
  }

  _drawCursor(ctx) {
    if (!this.hoverUV) return;
    const cx = this.hoverUV.x * W;
    const cy = (1 - this.hoverUV.y) * H;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PAL.sand;
    ctx.stroke();
  }

  _findHit(uv) {
    if (!uv) return null;
    const px = uv.x * W;
    const py = (1 - uv.y) * H;
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
