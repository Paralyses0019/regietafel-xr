// Hoofdbestand van Regietafel XR — verbindt WebXR (VR & MR), wereld, props, 3D-geluid, paneel en Play-tijdlijn
import * as THREE from 'three';
import {
  loadState, saveState, createInitialState, cloneCue,
  getActiveCue, getEnabledCues, emptyAmbience, PRESETS
} from './state.js';
import { AudioEngine } from './audio.js';
import { WorldManager } from './world.js';
import { PropsManager } from './props.js';
import { Panel3D } from './panel3d.js';
import { XRInputManager } from './xr-input.js';
import { createStudioEnvironment } from './materials.js';

const $ = s => document.querySelector(s);
const launcher = $('#launcher');
const stage = $('#stage');
const hud = $('#hud');
const toastEl = $('#toast');
const btnVR = $('#btn-vr');
const btnMR = $('#btn-mr');
const btnDesktop = $('#btn-desktop');
const vrStatus = $('#vr-status');
const mrStatus = $('#mr-status');

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

// 1. State & Three.js Renderer
let state = loadState();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = createStudioEnvironment(renderer);
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 120);
camera.position.set(0, 1.6, 0);
scene.add(camera);

const audio = new AudioEngine();
const world = new WorldManager(scene);
const propsMgr = new PropsManager(scene);
const getActiveCamera = () => (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
let needsXRRecenter = false;

// Playback controller
const playback = {
  active: false,
  queue: [],
  cursor: 0,
  elapsedInCue: 0
};

function syncAllToActiveCue(fadeSec = 0.25) {
  const cue = playback.active
    ? playback.queue[playback.cursor]?.cue || getActiveCue(state)
    : getActiveCue(state);

  const isBuild = state.mode === 'build';
  world.applyCueTarget(cue, fadeSec);
  propsMgr.sync(cue, isBuild, state.selectedObjectId);
  audio.setAmbience(cue.ambience, fadeSec);
  audio.syncSpatialSounds(cue.sounds);

  const playInfo = playback.active
    ? { step: playback.cursor + 1, total: playback.queue.length }
    : null;
  panel.render(state, playInfo);
  updateHudButtons();
}

function updateHudButtons() {
  const toggleBtn = $('#btn-toggle-panel');
  const playBtn = $('#btn-quick-play');
  if (state.mode === 'playing') {
    toggleBtn.hidden = true;
    playBtn.textContent = 'Stop ervaring';
  } else if (state.mode === 'ready' || state.mode === 'done') {
    toggleBtn.hidden = true;
    playBtn.textContent = 'Terug naar bouwen';
  } else {
    toggleBtn.hidden = false;
    toggleBtn.textContent = panel.hidden ? 'Toon paneel' : 'Verberg paneel';
    playBtn.textContent = 'Doorgeven';
  }
}

// 2. 3D Regiepaneel callbacks
const panel = new Panel3D(scene, {
  setTab(tab) {
    audio.playUiClick(false);
    state.activeTab = tab;
    saveState(state);
    panel.render(state);
  },

  loadPreset(key) {
    audio.playUiClick(true);
    const prevTab = state.activeTab;
    state = createInitialState(key);
    state.activeTab = prevTab;
    saveState(state);
    syncAllToActiveCue(0.6);
    showToast(`Voorbeeld geladen: ${PRESETS[key].label}`);
  },

  toggleHide() {
    audio.playUiClick(false);
    panel.setHidden(!panel.hidden, state);
    updateHudButtons();
  },

  recenterPanel() {
    audio.playUiClick(false);
    panel.recenterToCamera(getActiveCamera());
  },

  updateCue(patch, silent = false) {
    if (!silent) audio.playUiClick(false);
    const cue = getActiveCue(state);
    Object.assign(cue, patch);
    saveState(state);
    syncAllToActiveCue(0.2);
  },

  updateAmbience(key, value) {
    const cue = getActiveCue(state);
    cue.ambience[key] = +value.toFixed(2);
    saveState(state);
    audio.setAmbience(cue.ambience, 0.12);
  },

  clearAmbience() {
    audio.playUiClick(false);
    const cue = getActiveCue(state);
    cue.ambience = emptyAmbience();
    saveState(state);
    syncAllToActiveCue(0.2);
  },

  selectCue(idx) {
    audio.playUiClick(true);
    const target = state.cues[idx];
    if (!target.enabled) {
      // Kopieer huidige cue zodat je makkelijk kunt doorbouwen
      const copy = cloneCue(getActiveCue(state));
      copy.enabled = true;
      state.cues[idx] = copy;
    }
    state.activeCueIndex = idx;
    state.selectedObjectId = null;
    state.selectedKind = null;
    saveState(state);
    syncAllToActiveCue(0.5);
  },

  disableCue(idx) {
    if (idx === 0) return;
    audio.playUiClick(false);
    state.cues[idx].enabled = false;
    state.activeCueIndex = Math.max(0, idx - 1);
    saveState(state);
    syncAllToActiveCue(0.35);
  },

  spawnProp(type) {
    audio.playUiClick(true);
    const cue = getActiveCue(state);
    const item = propsMgr.spawnProp(cue, type, getActiveCamera());
    if (!item) {
      showToast('Maximaal aantal objecten bereikt');
      return;
    }
    state.selectedObjectId = item.id;
    state.selectedKind = 'prop';
    saveState(state);
    syncAllToActiveCue(0.2);
  },

  updateProp(id, patch) {
    audio.playUiClick(false);
    const cue = getActiveCue(state);
    const item = cue.props.find(p => p.id === id);
    if (!item) return;
    Object.assign(item, patch);
    saveState(state);
    syncAllToActiveCue(0.15);
  },

  nudgePropDistance(id, delta) {
    audio.playUiClick(false);
    const cue = getActiveCue(state);
    const item = cue.props.find(p => p.id === id);
    if (!item) return;
    const dist = Math.hypot(item.x, item.z) || 0.01;
    const next = Math.max(1.0, Math.min(9.0, dist + delta));
    const factor = next / dist;
    item.x = +(item.x * factor).toFixed(2);
    item.z = +(item.z * factor).toFixed(2);
    saveState(state);
    syncAllToActiveCue(0.15);
  },

  cycleSelectedProp() {
    audio.playUiClick(false);
    const cue = getActiveCue(state);
    if (!cue.props.length) return;
    const idx = cue.props.findIndex(p => p.id === state.selectedObjectId);
    const next = cue.props[(idx + 1) % cue.props.length];
    state.selectedObjectId = next.id;
    state.selectedKind = 'prop';
    syncAllToActiveCue(0.15);
  },

  clearProps() {
    audio.playUiClick(false);
    const cue = getActiveCue(state);
    cue.props = [];
    state.selectedObjectId = null;
    state.selectedKind = null;
    saveState(state);
    syncAllToActiveCue(0.15);
  },

  spawnSound(type) {
    audio.playUiClick(true);
    const cue = getActiveCue(state);
    const item = propsMgr.spawnSound(cue, type, getActiveCamera());
    if (!item) {
      showToast('Maximaal aantal geluidsbronnen bereikt');
      return;
    }
    state.selectedObjectId = item.id;
    state.selectedKind = 'sound';
    saveState(state);
    syncAllToActiveCue(0.2);
    audio.triggerSpatial(item.type, item, item.volume);
    propsMgr.triggerSoundPulse(item.id);
  },

  updateSound(id, patch) {
    const cue = getActiveCue(state);
    const item = cue.sounds.find(s => s.id === id);
    if (!item) return;
    Object.assign(item, patch);
    saveState(state);
    audio.syncSpatialSounds(cue.sounds);
  },

  moveSoundRelative(id, relX, relZ) {
    audio.playUiClick(false);
    const cue = getActiveCue(state);
    const item = cue.sounds.find(s => s.id === id);
    if (!item) return;
    // Bereken t.o.v. huidige kijkrichting van de speler!
    const activeCam = getActiveCamera();
    const forward = new THREE.Vector3();
    activeCam.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const pos = new THREE.Vector3();
    activeCam.getWorldPosition(pos);

    const worldPos = pos.clone()
      .addScaledVector(right, relX)
      .addScaledVector(forward, -relZ);
    item.x = +worldPos.x.toFixed(2);
    item.z = +worldPos.z.toFixed(2);
    saveState(state);
    syncAllToActiveCue(0.15);
    audio.triggerSpatial(item.type, item, item.volume);
    propsMgr.triggerSoundPulse(item.id);
  },

  testSound(id) {
    const cue = getActiveCue(state);
    const item = cue.sounds.find(s => s.id === id);
    if (!item) return;
    audio.triggerSpatial(item.type, item, item.volume);
    propsMgr.triggerSoundPulse(item.id);
  },

  deleteSelected(id, kind) {
    audio.playUiClick(false);
    const cue = getActiveCue(state);
    if (kind === 'prop') {
      cue.props = cue.props.filter(p => p.id !== id);
    } else {
      cue.sounds = cue.sounds.filter(s => s.id !== id);
    }
    state.selectedObjectId = null;
    state.selectedKind = null;
    saveState(state);
    syncAllToActiveCue(0.15);
  },

  enterReady() {
    audio.playUiClick(true);
    playback.active = false;
    state.mode = 'ready';
    panel.hidden = false;
    panel.recenterToCamera(getActiveCamera());
    audio.setMuted(true); // Stil terwijl de bril wordt doorgegeven
    syncAllToActiveCue(0.4);
  },

  startPlayback() {
    audio.playUiClick(true);
    audio.setMuted(false);
    const enabled = getEnabledCues(state);
    if (!enabled.length) return;
    playback.active = true;
    playback.queue = enabled;
    playback.cursor = 0;
    playback.elapsedInCue = 0;
    state.mode = 'playing';
    panel.recenterToCamera(getActiveCamera());
    syncAllToActiveCue(enabled[0].cue.transition || 1.2);
  },

  stopPlayback() {
    audio.playUiClick(false);
    playback.active = false;
    state.mode = 'ready';
    panel.recenterToCamera(getActiveCamera());
    audio.setMuted(true);
    syncAllToActiveCue(0.4);
  },

  backToBuild() {
    audio.playUiClick(false);
    playback.active = false;
    audio.setMuted(false);
    state.mode = 'build';
    panel.hidden = false;
    panel.recenterToCamera(getActiveCamera());
    syncAllToActiveCue(0.35);
  }
});

// 3. Input manager (Quest controllers + Hand Tracking + Desktop)
const xrInput = new XRInputManager(renderer, scene, camera, {
  getPanelMeshes: () => panel.getInteractiveMeshes(),
  getObjectMeshes: () => propsMgr.getInteractiveTargets(true),
  isBuildMode: () => state.mode === 'build',
  onRecenter: () => {
    if (state.mode !== 'playing') panel.recenterToCamera(getActiveCamera());
  },
  onPanelHover: (uv, dragging) => panel.handleHover(uv, dragging),
  onPanelDown: (uv, isPill) => panel.handlePointerDown(uv, isPill),
  onPanelUp: () => panel.handlePointerUp(),
  onObjectSelect: (id, kind) => {
    audio.playUiClick(false);
    state.selectedObjectId = id;
    state.selectedKind = kind;
    state.activeTab = kind === 'sound' ? 'geluid' : 'bouwen';
    syncAllToActiveCue(0.15);
  },
  getObjectY: (id, kind) => {
    const cue = getActiveCue(state);
    const list = kind === 'sound' ? cue.sounds : cue.props;
    return list.find(o => o.id === id)?.y ?? 0;
  },
  onObjectMove: (id, kind, x, z) => {
    const cue = getActiveCue(state);
    const list = kind === 'sound' ? cue.sounds : cue.props;
    const item = list.find(o => o.id === id);
    if (!item) return;
    item.x = x;
    item.z = z;
    saveState(state);
    propsMgr.sync(cue, true, state.selectedObjectId);
    if (kind === 'sound') audio.syncSpatialSounds(cue.sounds);
  }
});

// 4. WebXR availability checks
async function checkXR() {
  if (!navigator.xr) {
    vrStatus.textContent = 'Geen WebXR in deze browser (gebruik Quest-browser of test hieronder)';
    mrStatus.textContent = 'Alleen op Meta Quest 3';
    return;
  }
  try {
    const vrOk = await navigator.xr.isSessionSupported('immersive-vr');
    btnVR.disabled = !vrOk;
    vrStatus.textContent = vrOk ? 'Klaar — stap een volledige VR-wereld in' : 'Niet beschikbaar op dit apparaat';
  } catch {
    vrStatus.textContent = 'VR niet beschikbaar op dit apparaat';
  }
  try {
    const arOk = await navigator.xr.isSessionSupported('immersive-ar');
    btnMR.disabled = !arOk;
    mrStatus.textContent = arOk ? 'Klaar — bouw met deeltjes, geluid en objecten in het echte lokaal' : 'Alleen op Quest 3 / MR-bril';
  } catch {
    mrStatus.textContent = 'MR niet beschikbaar op dit apparaat';
  }
}
checkXR();

async function startSession(mode) {
  audio.init();
  launcher.hidden = true;
  stage.hidden = false;

  if (mode === 'desktop') {
    world.setARMode(false);
    panel.isAR = false;
    renderer.setClearColor(0x0b0f14, 1);
    hud.hidden = false;
    const desktopDist = window.innerWidth < window.innerHeight ? 2.05 : 1.32;
    panel.placeInFrontOf(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1), desktopDist);
    syncAllToActiveCue(0.3);
    return;
  }

  const isAR = mode === 'mr';
  try {
    const sessionType = isAR ? 'immersive-ar' : 'immersive-vr';
    const session = await navigator.xr.requestSession(sessionType, {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    });

    world.setARMode(isAR);
    panel.isAR = isAR;
    renderer.setClearColor(0x000000, isAR ? 0 : 1);
    hud.hidden = true;

    session.addEventListener('end', () => {
      playback.active = false;
      audio.setMuted(true);
      stage.hidden = true;
      launcher.hidden = false;
      hud.hidden = false;
      world.setARMode(false);
      panel.isAR = false;
    });

    await renderer.xr.setSession(session);
    needsXRRecenter = true;
    audio.setMuted(false);
    syncAllToActiveCue(0.4);
  } catch (err) {
    console.error(err);
    stage.hidden = true;
    launcher.hidden = false;
    showToast('Kon XR-sessie niet starten — probeer opnieuw of kies Desktop.');
  }
}

btnVR.addEventListener('click', () => startSession('vr'));
btnMR.addEventListener('click', () => startSession('mr'));
btnDesktop.addEventListener('click', () => startSession('desktop'));

$('#btn-exit').addEventListener('click', () => {
  playback.active = false;
  audio.setMuted(true);
  stage.hidden = true;
  launcher.hidden = false;
});
$('#btn-toggle-panel').addEventListener('click', () => {
  panel.setHidden(!panel.hidden, state);
  updateHudButtons();
});
$('#btn-quick-play').addEventListener('click', () => {
  if (state.mode === 'playing') {
    panel.cb.stopPlayback();
  } else if (state.mode === 'ready' || state.mode === 'done') {
    panel.cb.backToBuild();
  } else {
    panel.cb.enterReady();
  }
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state.mode === 'playing') {
    panel.cb.stopPlayback();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 5. Render loop
const headPos = new THREE.Vector3();
const headQuat = new THREE.Quaternion();
let lastTime = performance.now() / 1000;

renderer.setAnimationLoop(() => {
  const now = performance.now() / 1000;
  const dt = Math.min(0.1, Math.max(0.001, now - lastTime));
  lastTime = now;

  const activeCam = getActiveCamera();
  if (needsXRRecenter && renderer.xr.isPresenting) {
    activeCam.getWorldPosition(headPos);
    if (headPos.lengthSq() > 0.0001) {
      needsXRRecenter = false;
      panel.recenterToCamera(activeCam);
    }
  }

  // Playback tijdlijn doortellen
  if (playback.active && state.mode === 'playing') {
    const current = playback.queue[playback.cursor];
    if (current) {
      playback.elapsedInCue += dt;
      if (playback.elapsedInCue >= current.cue.duration) {
        playback.cursor++;
        playback.elapsedInCue = 0;
        if (playback.cursor >= playback.queue.length) {
          playback.active = false;
          state.mode = 'done';
          panel.recenterToCamera(activeCam);
          panel.render(state);
          updateHudButtons();
        } else {
          const next = playback.queue[playback.cursor];
          syncAllToActiveCue(next.cue.transition || 4.0);
        }
      }
    }
  }

  xrInput.update(now, state.mode === 'playing');
  world.update(dt, now);
  propsMgr.update(dt, now, activeCam);

  // Update 3D Audio Listener met actuele hoofdpositie/rotatie
  activeCam.getWorldPosition(headPos);
  activeCam.getWorldQuaternion(headQuat);
  audio.update(dt, headPos, headQuat, (soundId) => propsMgr.triggerSoundPulse(soundId));

  renderer.render(scene, camera);
});
