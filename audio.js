// 100% procedurele Web Audio engine v3 — vrolijke vogels, zonnig majeur-akkoord, windgong + natuur & spanning
import * as THREE from 'three';
import { SOUND_TYPES } from './state.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.layerGains = {};
    this.activeSources = new Map();
    this.heartbeatTimer = 0;
    this.crackleTimer = 0;
    this.birdTimer = 0;
    this.running = false;
    this.muted = false;
    this._forward = new THREE.Vector3();
    this._up = new THREE.Vector3();
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 20;
    comp.ratio.value = 6;
    comp.attack.value = 0.008;
    comp.release.value = 0.2;

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    this.noiseBuffer = this._createNoiseBuffer(4);
    this._buildAmbienceLayers();
    this.running = true;
  }

  _createNoiseBuffer(seconds) {
    const sr = this.ctx.sampleRate;
    const len = sr * seconds;
    const buffer = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  _makeLoopNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.start();
    return src;
  }

  _buildAmbienceLayers() {
    const ctx = this.ctx;

    // 1. Vogels / Zomer: lichte zomerse bries-bed + vrolijke vogeltsjilpjes in update()
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const src = this._makeLoopNoise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 0.9;
      const breezeGain = ctx.createGain();
      breezeGain.gain.value = 0.14;
      src.connect(bp);
      bp.connect(breezeGain);
      breezeGain.connect(gain);
      gain.connect(this.master);
      this.layerGains.vogels = gain;
    }

    // 2. Zonnig akkoord: warme, optimistische Cmaj9-pad met zachte zweving
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 920;

      // C4, E4, G4, B4, D5 (licht, optimistisch, open majeur-9)
      const freqs = [261.63, 329.63, 392.0, 493.88, 587.33];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx < 2 ? 'sine' : 'triangle';
        osc.frequency.value = f + (idx % 2 === 0 ? 0.35 : -0.35);
        const g = ctx.createGain();
        g.gain.value = idx < 3 ? 0.075 : 0.038;
        osc.connect(g);
        g.connect(lp);
        osc.start();
      });

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.18;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 260;
      lfo.connect(lfoG);
      lfoG.connect(lp.frequency);
      lfo.start();

      lp.connect(gain);
      gain.connect(this.master);
      this.layerGains.akkoord = gain;
    }

    // 3. Kampvuur
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const src = this._makeLoopNoise();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      src.connect(lp);
      lp.connect(gain);
      gain.connect(this.master);
      this.layerGains.vuur = gain;
    }

    // 4. Regen
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const src = this._makeLoopNoise();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 520;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3600;
      src.connect(hp);
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(this.master);
      this.layerGains.regen = gain;
    }

    // 5. Bries / wind
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const src = this._makeLoopNoise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 340;
      bp.Q.value = 2.4;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 140;
      lfo.connect(lfoG);
      lfoG.connect(bp.frequency);
      lfo.start();

      src.connect(bp);
      bp.connect(gain);
      gain.connect(this.master);
      this.layerGains.wind = gain;
    }

    // 6. Spanning + zachte hartslag
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 240;

      [55.0, 58.27, 110.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 2 ? 'sawtooth' : 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = idx === 2 ? 0.032 : 0.15;
        osc.connect(g);
        g.connect(lp);
        osc.start();
      });

      lp.connect(gain);
      gain.connect(this.master);
      this.layerGains.spanning = gain;
    }
  }

  setAmbience(ambience, fadeSeconds = 0.25) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = Math.max(0.08, fadeSeconds);
    const scales = {
      vogels: 0.7,
      akkoord: 0.55,
      vuur: 0.65,
      regen: 0.45,
      wind: 0.52,
      spanning: 0.52
    };
    for (const [key, gainNode] of Object.entries(this.layerGains)) {
      const val = Math.max(0, Math.min(1, ambience?.[key] ?? 0));
      const target = this.muted ? 0 : val * (scales[key] ?? 0.5);
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(target, now + ramp);
    }
    this._currentAmbience = ambience;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this._currentAmbience) {
      this.setAmbience(this._currentAmbience, 0.15);
    }
  }

  syncSpatialSounds(soundsList) {
    const incoming = new Set();
    const now = performance.now() / 1000;
    for (const s of soundsList || []) {
      incoming.add(s.id);
      const existing = this.activeSources.get(s.id);
      if (existing) {
        existing.data = s;
      } else {
        const meta = SOUND_TYPES.find(t => t.id === s.type) || SOUND_TYPES[0];
        this.activeSources.set(s.id, {
          data: s,
          nextTrigger: now + 0.6 + Math.random() * Math.min(2.0, meta.interval * 0.5)
        });
      }
    }
    for (const id of [...this.activeSources.keys()]) {
      if (!incoming.has(id)) this.activeSources.delete(id);
    }
  }

  update(dt, headPos, headQuat, onSoundPulse = null) {
    if (!this.ctx || this.ctx.state !== 'running') return;

    const listener = this.ctx.listener;
    this._forward.set(0, 0, -1).applyQuaternion(headQuat);
    this._up.set(0, 1, 0).applyQuaternion(headQuat);

    if (listener.positionX) {
      const t = this.ctx.currentTime;
      listener.positionX.setValueAtTime(headPos.x, t);
      listener.positionY.setValueAtTime(headPos.y, t);
      listener.positionZ.setValueAtTime(headPos.z, t);
      listener.forwardX.setValueAtTime(this._forward.x, t);
      listener.forwardY.setValueAtTime(this._forward.y, t);
      listener.forwardZ.setValueAtTime(this._forward.z, t);
      listener.upX.setValueAtTime(this._up.x, t);
      listener.upY.setValueAtTime(this._up.y, t);
      listener.upZ.setValueAtTime(this._up.z, t);
    }

    if (this.muted) return;

    // 1. Zomerse zangvogels (ambient rondom je heen)
    const birdVol = this._currentAmbience?.vogels || 0;
    if (birdVol > 0.04) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 0.75 + Math.random() * (2.6 - birdVol * 1.1);
        const angle = Math.random() * Math.PI * 2;
        const dist = 3.0 + Math.random() * 4.5;
        this.triggerSpatial('vogel', {
          x: headPos.x + Math.cos(angle) * dist,
          y: headPos.y + 1.2 + Math.random() * 2.0,
          z: headPos.z + Math.sin(angle) * dist
        }, birdVol * 0.75);
      }
    }

    // 2. Kampvuur-knispers
    const vuurVol = this._currentAmbience?.vuur || 0;
    if (vuurVol > 0.04) {
      this.crackleTimer -= dt;
      if (this.crackleTimer <= 0) {
        this.crackleTimer = 0.08 + Math.random() * 0.28;
        this._playCrackle(vuurVol);
      }
    }

    // 3. Zachte hartslag gekoppeld aan Spanning > 0.35
    const spanVol = this._currentAmbience?.spanning || 0;
    if (spanVol > 0.35) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = 0.94;
        this._playHeartbeat((spanVol - 0.3) * 1.1);
      }
    }

    // 4. Periodieke 3D-geluidsbronnen
    const nowSec = performance.now() / 1000;
    for (const [id, entry] of this.activeSources.entries()) {
      if (nowSec >= entry.nextTrigger) {
        const meta = SOUND_TYPES.find(t => t.id === entry.data.type) || SOUND_TYPES[0];
        this.triggerSpatial(entry.data.type, entry.data, entry.data.volume ?? 0.8);
        entry.nextTrigger = nowSec + meta.interval * (0.75 + Math.random() * 0.5);
        if (onSoundPulse) onSoundPulse(id);
      }
    }
  }

  _playCrackle(vol) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 3400;
    bp.Q.value = 3.5;
    const env = ctx.createGain();
    const amp = (0.04 + Math.random() * 0.14) * vol;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(amp, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    src.connect(bp);
    bp.connect(env);
    env.connect(this.master);
    src.start(now, Math.random() * 2.5, 0.07);
  }

  _playHeartbeat(vol) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const thump = (offset, freqStart, amp) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, now + offset);
      osc.frequency.exponentialRampToValueAtTime(36, now + offset + 0.14);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now + offset);
      env.gain.linearRampToValueAtTime(amp * vol, now + offset + 0.025);
      env.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
      osc.connect(env);
      env.connect(this.master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.24);
    };
    thump(0, 72, 0.42);
    thump(0.22, 60, 0.26);
  }

  _createPanner(pos) {
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.4;
    panner.maxDistance = 26;
    panner.rolloffFactor = 1.05;
    if (panner.positionX) {
      const t = this.ctx.currentTime;
      panner.positionX.setValueAtTime(pos.x, t);
      panner.positionY.setValueAtTime(pos.y, t);
      panner.positionZ.setValueAtTime(pos.z, t);
    }
    panner.connect(this.master);
    return panner;
  }

  triggerSpatial(type, pos, volume = 0.8) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const panner = this._createPanner(pos);
    const v = Math.max(0.05, Math.min(1, volume));

    if (type === 'vogel') {
      // Vrolijk melodieus merel/mees-motief (2-3 snelle fluitnootjes)
      const base = 1650 + Math.random() * 950;
      const notes = Math.random() > 0.45 ? [0, 0.11, 0.24] : [0, 0.13];
      notes.forEach((off, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const f0 = base * (i === 1 ? 1.25 : i === 2 ? 1.12 : 1.0);
        osc.frequency.setValueAtTime(f0, now + off);
        osc.frequency.exponentialRampToValueAtTime(f0 * (i % 2 === 0 ? 1.28 : 0.86), now + off + 0.085);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now + off);
        env.gain.linearRampToValueAtTime(0.14 * v, now + off + 0.018);
        env.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.11);
        osc.connect(env);
        env.connect(panner);
        osc.start(now + off);
        osc.stop(now + off + 0.13);
      });
    } else if (type === 'klankschaal') {
      // Heldere vrolijke pentatonische windgong (2-3 glinsterende klokjes)
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const pick = [0, 1, 2].map(() => scale[Math.floor(Math.random() * scale.length)]);
      pick.forEach((f, idx) => {
        const off = idx * 0.14;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now + off);
        env.gain.linearRampToValueAtTime(0.15 * v, now + off + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, now + off + 2.4);
        osc.connect(env);
        env.connect(panner);
        osc.start(now + off);
        osc.stop(now + off + 2.5);
      });
    } else if (type === 'voetstap') {
      [0, 0.48].forEach((offset, i) => {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = i === 0 ? 280 : 320;
        bp.Q.value = 1.2;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now + offset);
        env.gain.linearRampToValueAtTime(0.55 * v, now + offset + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
        src.connect(bp);
        bp.connect(env);
        env.connect(panner);
        src.start(now + offset, Math.random() * 2, 0.2);
      });
    } else if (type === 'tak') {
      [0, 0.06].forEach((offset, idx) => {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = idx === 0 ? 1650 : 980;
        bp.Q.value = 2.8;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now + offset);
        env.gain.linearRampToValueAtTime((idx === 0 ? 0.6 : 0.35) * v, now + offset + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.09);
        src.connect(bp);
        bp.connect(env);
        env.connect(panner);
        src.start(now + offset, Math.random() * 2.5, 0.12);
      });
    }

    setTimeout(() => {
      try { panner.disconnect(); } catch {}
    }, 3500);
  }

  playUiClick(high = false) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 680 : 460, now);
    osc.frequency.exponentialRampToValueAtTime(high ? 920 : 320, now + 0.045);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.05, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}
