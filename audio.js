// 100% procedurele Web Audio engine met 6 sfeerlagen + 3D HRTF-geluidsbronnen
import * as THREE from 'three';
import { SOUND_TYPES } from './state.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.layers = {};
    this.layerGains = {};
    this.activeSources = new Map(); // id -> { data, nextTrigger }
    this.heartbeatTimer = 0;
    this.crackleTimer = 0;
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

    // 1. Regen: zachte breedband regen + hogere druppel-siss
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

    // 2. Wind: langzaam golvende bandpass-ruis
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const src = this._makeLoopNoise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 310;
      bp.Q.value = 2.6;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 140;
      lfo.connect(lfoGain);
      lfoGain.connect(bp.frequency);
      lfo.start();

      src.connect(bp);
      bp.connect(gain);
      gain.connect(this.master);
      this.layerGains.wind = gain;
    }

    // 3. Kampvuur: warme lage gloed + procedurele knisper-tikjes in update()
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

    // 4. Warme drone: rustige kwint-klank (C3 + G3 + C4)
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 480;

      [130.81, 196.0, 261.63, 131.4].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = idx === 2 ? 0.06 : 0.11;
        osc.connect(g);
        g.connect(lp);
        osc.start();
      });

      lp.connect(gain);
      gain.connect(this.master);
      this.layerGains.drone = gain;
    }

    // 5. Spanning: donkere zwevende sub-drone met lichte wrijving
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
        g.gain.value = idx === 2 ? 0.035 : 0.16;
        osc.connect(g);
        g.connect(lp);
        osc.start();
      });

      lp.connect(gain);
      gain.connect(this.master);
      this.layerGains.spanning = gain;
    }

    // 6. Hartslag: gain-bus voor de ritmische lub-dub
    {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.master);
      this.layerGains.hartslag = gain;
    }
  }

  setAmbience(ambience, fadeSeconds = 0.25) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = Math.max(0.08, fadeSeconds);
    const scales = {
      regen: 0.45,
      wind: 0.55,
      vuur: 0.65,
      drone: 0.45,
      spanning: 0.5,
      hartslag: 0.85
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
          nextTrigger: now + 0.6 + Math.random() * Math.min(2.0, meta.interval * 0.5),
          pulseAt: 0
        });
      }
    }
    for (const id of [...this.activeSources.keys()]) {
      if (!incoming.has(id)) {
        this.activeSources.delete(id);
      }
    }
  }

  update(dt, headPos, headQuat, onSoundPulse = null) {
    if (!this.ctx || this.ctx.state !== 'running') return;

    // 1. Update 3D AudioListener pose
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
    } else if (listener.setPosition) {
      listener.setPosition(headPos.x, headPos.y, headPos.z);
      listener.setOrientation(
        this._forward.x, this._forward.y, this._forward.z,
        this._up.x, this._up.y, this._up.z
      );
    }

    if (this.muted) return;

    // 2. Kampvuur-knispers
    const vuurVol = this._currentAmbience?.vuur || 0;
    if (vuurVol > 0.04) {
      this.crackleTimer -= dt;
      if (this.crackleTimer <= 0) {
        this.crackleTimer = 0.08 + Math.random() * 0.28;
        this._playCrackle(vuurVol);
      }
    }

    // 3. Hartslag (lub-dub)
    const heartVol = this._currentAmbience?.hartslag || 0;
    if (heartVol > 0.04) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = 0.92;
        this._playHeartbeat(heartVol);
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
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.028 + Math.random() * 0.03);
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
      env.connect(this.layerGains.hartslag);
      osc.start(now + offset);
      osc.stop(now + offset + 0.24);
    };
    thump(0, 74, 0.72);
    thump(0.22, 62, 0.45);
  }

  _createPanner(pos) {
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.2;
    panner.maxDistance = 24;
    panner.rolloffFactor = 1.15;
    if (panner.positionX) {
      const t = this.ctx.currentTime;
      panner.positionX.setValueAtTime(pos.x, t);
      panner.positionY.setValueAtTime(pos.y, t);
      panner.positionZ.setValueAtTime(pos.z, t);
    } else {
      panner.setPosition(pos.x, pos.y, pos.z);
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

    if (type === 'voetstap') {
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
    } else if (type === 'klankschaal') {
      const freqs = [293.66, 589.5, 882.2];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const env = ctx.createGain();
        const peak = (idx === 0 ? 0.24 : idx === 1 ? 0.11 : 0.05) * v;
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(peak, now + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0001, now + (idx === 0 ? 3.8 : 2.2));
        osc.connect(env);
        env.connect(panner);
        osc.start(now);
        osc.stop(now + 4.0);
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
    } else if (type === 'windvlaag') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3.2;
      bp.frequency.setValueAtTime(220, now);
      bp.frequency.exponentialRampToValueAtTime(640, now + 0.9);
      bp.frequency.exponentialRampToValueAtTime(190, now + 2.3);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.45 * v, now + 0.75);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      src.connect(bp);
      bp.connect(env);
      env.connect(panner);
      src.start(now, Math.random(), 2.5);
    }

    setTimeout(() => {
      try { panner.disconnect(); } catch {}
    }, 4500);
  }

  playUiClick(high = false) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 680 : 460, now);
    osc.frequency.exponentialRampToValueAtTime(high ? 920 : 320, now + 0.045);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.06, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}
