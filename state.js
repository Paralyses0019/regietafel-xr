// Datamodel, presets, localStorage-opslag en cue-interpolatie voor Regietafel XR

export const STORAGE_KEY = 'regietafel-xr-state-v1';

export const ENVIRONMENTS = [
  { id: 'hal', label: 'Lege hal' },
  { id: 'water', label: 'Water' },
  { id: 'bos', label: 'Nachtbos' },
  { id: 'schuilplek', label: 'Schuilplek' }
];

export const COLORS = [
  { id: 'warm', label: 'Warm goud', hex: '#f4b56a', skyTop: '#1c1310', skyMid: '#4c2c1b', fog: '#2b1b14', light: '#ffcf8f', accent: '#f4b56a' },
  { id: 'koel', label: 'Koel blauw', hex: '#63b4ff', skyTop: '#081322', skyMid: '#183758', fog: '#102236', light: '#99d1ff', accent: '#63b4ff' },
  { id: 'rood', label: 'Avondrood', hex: '#ef6a63', skyTop: '#1d0b10', skyMid: '#591d24', fog: '#2e1116', light: '#ff9689', accent: '#ef6a63' },
  { id: 'paars', label: 'Diep paars', hex: '#ab80ff', skyTop: '#120b24', skyMid: '#34205c', fog: '#1e1336', light: '#cdb5ff', accent: '#ab80ff' },
  { id: 'groen', label: 'Bosgroen', hex: '#4ec9a3', skyTop: '#081b18', skyMid: '#16453c', fog: '#0e2924', light: '#8cebd0', accent: '#4ec9a3' },
  { id: 'wit', label: 'Helder wit', hex: '#dce7f2', skyTop: '#1c2530', skyMid: '#485b70', fog: '#2a3644', light: '#f4f8ff', accent: '#dce7f2' }
];

export const PARTICLES = [
  { id: 'uit', label: 'Uit' },
  { id: 'regen', label: 'Regen' },
  { id: 'vuurvliegjes', label: 'Vuurvliegjes' },
  { id: 'sneeuw', label: 'Sneeuw' },
  { id: 'stof', label: 'Stof' },
  { id: 'sterren', label: 'Sterren' }
];

export const AMBIENCE_ITEMS = [
  { id: 'regen', label: 'Regen' },
  { id: 'wind', label: 'Wind' },
  { id: 'vuur', label: 'Kampvuur' },
  { id: 'drone', label: 'Warme drone' },
  { id: 'spanning', label: 'Spanning' },
  { id: 'hartslag', label: 'Hartslag' }
];

export const SOUND_TYPES = [
  { id: 'voetstap', label: 'Voetstappen', color: '#ff8a75', interval: 2.8 },
  { id: 'klankschaal', label: 'Klankschaal', color: '#7be3d0', interval: 5.5 },
  { id: 'tak', label: 'Krakende tak', color: '#f2c16b', interval: 4.8 },
  { id: 'windvlaag', label: 'Windvlaag', color: '#8cc5ff', interval: 6.2 }
];

export const PROP_TYPES = [
  { id: 'zuil', label: 'Zuil / Muur', defaultY: 0, maxScale: 1.8 },
  { id: 'poort', label: 'Poort', defaultY: 0, maxScale: 1.6 },
  { id: 'lichtbol', label: 'Lichtbol', defaultY: 1.55, maxScale: 1.8 },
  { id: 'kampvuur', label: 'Kampvuur', defaultY: 0, maxScale: 1.6 },
  { id: 'boom', label: 'Boom / Rots', defaultY: 0, maxScale: 1.7 },
  { id: 'dak', label: 'Schuil-dak', defaultY: 2.55, maxScale: 1.6 }
];

export const PROP_COLORS = [
  '#f4b56a', '#63b4ff', '#ef6a63', '#ab80ff', '#4ec9a3', '#e8eef5'
];

export const MAX_PROPS = 16;
export const MAX_SOUNDS = 6;

let uidCounter = 1;
export function nextId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
}

export function emptyAmbience() {
  return { regen: 0, wind: 0, vuur: 0, drone: 0, spanning: 0, hartslag: 0 };
}

export function createCue(overrides = {}) {
  return {
    enabled: false,
    duration: 18,
    transition: 4.0,
    env: 'schuilplek',
    color: 'warm',
    brightness: 0.62,
    fog: 0.28,
    particles: 'vuurvliegjes',
    pulse: 0.3,
    ambience: { ...emptyAmbience(), ...(overrides.ambience || {}) },
    props: [],
    sounds: [],
    ...overrides
  };
}

export function cloneCue(cue) {
  return {
    ...cue,
    ambience: { ...cue.ambience },
    props: (cue.props || []).map(p => ({ ...p })),
    sounds: (cue.sounds || []).map(s => ({ ...s }))
  };
}

export const PRESETS = {
  schuilplek: {
    label: 'Rustige schuilplek',
    cues: [
      createCue({
        enabled: true, duration: 15, transition: 4.0,
        env: 'schuilplek', color: 'warm', brightness: 0.52, fog: 0.32,
        particles: 'stof', pulse: 0.22,
        ambience: { ...emptyAmbience(), wind: 0.35, drone: 0.25 },
        props: [
          { id: 'p_s1', type: 'kampvuur', x: 0, y: 0, z: -2.4, scale: 1.0, rotY: 0, color: '#f4b56a' }
        ],
        sounds: [
          { id: 's_s1', type: 'klankschaal', x: 2.2, y: 1.5, z: -1.6, volume: 0.65 }
        ]
      }),
      createCue({
        enabled: true, duration: 20, transition: 4.0,
        env: 'schuilplek', color: 'warm', brightness: 0.72, fog: 0.2,
        particles: 'vuurvliegjes', pulse: 0.45,
        ambience: { ...emptyAmbience(), vuur: 0.55, drone: 0.42 },
        props: [
          { id: 'p_s1', type: 'kampvuur', x: 0, y: 0, z: -2.4, scale: 1.15, rotY: 0, color: '#f4b56a' },
          { id: 'p_s2', type: 'lichtbol', x: -1.8, y: 1.6, z: -2.0, scale: 0.85, rotY: 0, color: '#f4b56a' },
          { id: 'p_s3', type: 'lichtbol', x: 1.9, y: 1.8, z: -1.9, scale: 0.85, rotY: 0, color: '#4ec9a3' }
        ],
        sounds: [
          { id: 's_s1', type: 'klankschaal', x: 2.2, y: 1.5, z: -1.6, volume: 0.85 }
        ]
      }),
      createCue({
        enabled: true, duration: 15, transition: 4.0,
        env: 'water', color: 'koel', brightness: 0.48, fog: 0.18,
        particles: 'sterren', pulse: 0.18,
        ambience: { ...emptyAmbience(), wind: 0.22, drone: 0.35 },
        props: [
          { id: 'p_s4', type: 'poort', x: 0, y: 0, z: -3.2, scale: 1.1, rotY: 0, color: '#63b4ff' }
        ],
        sounds: [
          { id: 's_s2', type: 'windvlaag', x: -2.4, y: 1.7, z: 0.6, volume: 0.55 }
        ]
      }),
      createCue({ enabled: false })
    ]
  },

  spanning: {
    label: 'Spannend donker',
    cues: [
      createCue({
        enabled: true, duration: 14, transition: 4.0,
        env: 'hal', color: 'koel', brightness: 0.25, fog: 0.62,
        particles: 'stof', pulse: 0.15,
        ambience: { ...emptyAmbience(), wind: 0.4, spanning: 0.35 },
        props: [
          { id: 'p_d1', type: 'zuil', x: -2.1, y: 0, z: -2.6, scale: 1.2, rotY: 0.3, color: '#63b4ff' },
          { id: 'p_d2', type: 'zuil', x: 2.1, y: 0, z: -2.6, scale: 1.2, rotY: -0.3, color: '#63b4ff' }
        ],
        sounds: [
          { id: 's_d1', type: 'voetstap', x: 0.4, y: 0.5, z: 2.7, volume: 0.75 }
        ]
      }),
      createCue({
        enabled: true, duration: 16, transition: 4.0,
        env: 'bos', color: 'paars', brightness: 0.18, fog: 0.78,
        particles: 'regen', pulse: 0.55,
        ambience: { ...emptyAmbience(), regen: 0.55, spanning: 0.55, hartslag: 0.48 },
        props: [
          { id: 'p_d1', type: 'zuil', x: -1.7, y: 0, z: -2.1, scale: 1.35, rotY: 0.3, color: '#ab80ff' },
          { id: 'p_d2', type: 'zuil', x: 1.7, y: 0, z: -2.1, scale: 1.35, rotY: -0.3, color: '#ab80ff' },
          { id: 'p_d3', type: 'boom', x: -2.5, y: 0, z: 1.4, scale: 1.2, rotY: 0, color: '#ab80ff' }
        ],
        sounds: [
          { id: 's_d1', type: 'voetstap', x: -0.6, y: 0.5, z: 2.0, volume: 0.9 },
          { id: 's_d2', type: 'tak', x: 2.1, y: 1.1, z: 1.1, volume: 0.85 }
        ]
      }),
      createCue({
        enabled: true, duration: 12, transition: 0.4,
        env: 'hal', color: 'rood', brightness: 0.65, fog: 0.55,
        particles: 'stof', pulse: 0.9,
        ambience: { ...emptyAmbience(), spanning: 0.75, hartslag: 0.85 },
        props: [
          { id: 'p_d4', type: 'poort', x: 0, y: 0, z: -2.5, scale: 1.3, rotY: 0, color: '#ef6a63' },
          { id: 'p_d5', type: 'lichtbol', x: 0, y: 1.7, z: -2.5, scale: 1.3, rotY: 0, color: '#ef6a63' }
        ],
        sounds: [
          { id: 's_d3', type: 'windvlaag', x: 0, y: 1.6, z: -2.2, volume: 0.95 }
        ]
      }),
      createCue({
        enabled: true, duration: 14, transition: 4.0,
        env: 'water', color: 'warm', brightness: 0.6, fog: 0.16,
        particles: 'vuurvliegjes', pulse: 0.15,
        ambience: { ...emptyAmbience(), drone: 0.45 },
        props: [],
        sounds: [
          { id: 's_d4', type: 'klankschaal', x: 0, y: 1.6, z: -2.5, volume: 0.75 }
        ]
      })
    ]
  },

  lokaal: {
    label: 'MR Vuurvliegjes',
    cues: [
      createCue({
        enabled: true, duration: 15, transition: 4.0,
        env: 'hal', color: 'groen', brightness: 0.62, fog: 0.12,
        particles: 'vuurvliegjes', pulse: 0.35,
        ambience: { ...emptyAmbience(), wind: 0.3, drone: 0.3 },
        props: [
          { id: 'p_m1', type: 'lichtbol', x: -1.4, y: 1.5, z: -2.0, scale: 0.8, rotY: 0, color: '#4ec9a3' },
          { id: 'p_m2', type: 'lichtbol', x: 1.5, y: 1.7, z: -1.9, scale: 0.8, rotY: 0, color: '#f4b56a' }
        ],
        sounds: [
          { id: 's_m1', type: 'klankschaal', x: -1.8, y: 1.5, z: -1.5, volume: 0.7 }
        ]
      }),
      createCue({
        enabled: true, duration: 18, transition: 4.0,
        env: 'hal', color: 'paars', brightness: 0.78, fog: 0.18,
        particles: 'sterren', pulse: 0.6,
        ambience: { ...emptyAmbience(), vuur: 0.4, drone: 0.55 },
        props: [
          { id: 'p_m1', type: 'lichtbol', x: -1.4, y: 1.5, z: -2.0, scale: 1.0, rotY: 0, color: '#ab80ff' },
          { id: 'p_m2', type: 'lichtbol', x: 1.5, y: 1.7, z: -1.9, scale: 1.0, rotY: 0, color: '#63b4ff' },
          { id: 'p_m3', type: 'kampvuur', x: 0, y: 0, z: -2.1, scale: 1.0, rotY: 0, color: '#f4b56a' }
        ],
        sounds: [
          { id: 's_m1', type: 'klankschaal', x: 1.8, y: 1.5, z: -1.5, volume: 0.8 },
          { id: 's_m2', type: 'windvlaag', x: 0, y: 1.8, z: 2.0, volume: 0.55 }
        ]
      }),
      createCue({ enabled: false }),
      createCue({ enabled: false })
    ]
  }
};

export function createInitialState(presetKey = 'schuilplek') {
  const preset = PRESETS[presetKey] || PRESETS.schuilplek;
  return {
    activeCueIndex: 0,
    activeTab: 'sfeer', // 'sfeer' | 'geluid' | 'bouwen'
    mode: 'build',      // 'build' | 'ready' | 'playing' | 'done'
    selectedObjectId: null, // prop or sound id
    selectedKind: null,     // 'prop' | 'sound'
    cues: preset.cues.map(cloneCue)
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState('schuilplek');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cues) || parsed.cues.length !== 4) {
      return createInitialState('schuilplek');
    }
    const cues = parsed.cues.map((c, idx) => createCue({
      ...c,
      enabled: idx === 0 ? true : !!c.enabled,
      ambience: { ...emptyAmbience(), ...(c.ambience || {}) },
      props: Array.isArray(c.props) ? c.props : [],
      sounds: Array.isArray(c.sounds) ? c.sounds : []
    }));
    return {
      activeCueIndex: Math.min(3, Math.max(0, parsed.activeCueIndex | 0)),
      activeTab: ['sfeer', 'geluid', 'bouwen'].includes(parsed.activeTab) ? parsed.activeTab : 'sfeer',
      mode: 'build',
      selectedObjectId: null,
      selectedKind: null,
      cues
    };
  } catch {
    return createInitialState('schuilplek');
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeCueIndex: state.activeCueIndex,
      activeTab: state.activeTab,
      cues: state.cues
    }));
  } catch {
    // Opslag kan uitstaan in privémodus; negeer stil.
  }
}

export function getColorPalette(colorId) {
  return COLORS.find(c => c.id === colorId) || COLORS[0];
}

export function getActiveCue(state) {
  return state.cues[state.activeCueIndex];
}

export function getEnabledCues(state) {
  return state.cues
    .map((cue, index) => ({ cue, index }))
    .filter(item => item.cue.enabled);
}
