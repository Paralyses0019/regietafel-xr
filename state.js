// Datamodel v3: volledige emotionele bandbreedte (van vrolijke zomerdag & pastel tot rustig warm & spannend donker)

export const STORAGE_KEY = 'regietafel-xr-state-v3';

export const ENVIRONMENTS = [
  { id: 'hal', label: 'Galerie' },
  { id: 'water', label: 'Water' },
  { id: 'bos', label: 'Bos / Tuin' },
  { id: 'schuilplek', label: 'Paviljoen' }
];

export const COLORS = [
  {
    id: 'zomer', label: 'Zomerzon', hex: '#ffd166', isBright: true,
    skyTop: '#2c7cc4', skyMid: '#a9e2fb', fog: '#c6e8f7',
    light: '#fff5d6', accent: '#ffd166', groundTint: '#7a9e66', sunColor: '#fff3c4'
  },
  {
    id: 'pastel', label: 'Pastel', hex: '#ff9ebb', isBright: true,
    skyTop: '#6c6ea8', skyMid: '#ffb997', fog: '#f2c6b8',
    light: '#ffe4d4', accent: '#ff9ebb', groundTint: '#7e8a6b', sunColor: '#ffe0b5'
  },
  {
    id: 'lente', label: 'Lente', hex: '#5ce1b8', isBright: true,
    skyTop: '#1f7a7c', skyMid: '#9ef0d6', fog: '#a9e5d7',
    light: '#e8fff6', accent: '#5ce1b8', groundTint: '#5d9b6f', sunColor: '#e8fff2'
  },
  {
    id: 'warm', label: 'Avondgoud', hex: '#f4b56a', isBright: false,
    skyTop: '#16100e', skyMid: '#4c2c1b', fog: '#2b1b14',
    light: '#ffcf8f', accent: '#f4b56a', groundTint: '#3b3530', sunColor: '#ffb366'
  },
  {
    id: 'koel', label: 'Nachtblauw', hex: '#63b4ff', isBright: false,
    skyTop: '#07111f', skyMid: '#183758', fog: '#102236',
    light: '#99d1ff', accent: '#63b4ff', groundTint: '#263240', sunColor: '#b8dcff'
  },
  {
    id: 'rood', label: 'Spanning', hex: '#ef6a63', isBright: false,
    skyTop: '#1a090d', skyMid: '#591d24', fog: '#2b1015',
    light: '#ff9689', accent: '#ef6a63', groundTint: '#362225', sunColor: '#ff7066'
  }
];

export const PARTICLES = [
  { id: 'uit', label: 'Uit' },
  { id: 'bloesem', label: 'Bloesem' },
  { id: 'vuurvliegjes', label: 'Vuurvliegjes' },
  { id: 'regen', label: 'Regen' },
  { id: 'sneeuw', label: 'Sneeuw' },
  { id: 'sterren', label: 'Sterren' }
];

export const AMBIENCE_ITEMS = [
  { id: 'vogels', label: 'Vogels / zomer' },
  { id: 'akkoord', label: 'Zonnig akkoord' },
  { id: 'vuur', label: 'Kampvuur' },
  { id: 'regen', label: 'Regen' },
  { id: 'wind', label: 'Bries / wind' },
  { id: 'spanning', label: 'Spanning + puls' }
];

export const SOUND_TYPES = [
  { id: 'vogel', label: 'Zangvogel', color: '#ffd166', interval: 3.6 },
  { id: 'klankschaal', label: 'Windgong', color: '#5ce1b8', interval: 4.4 },
  { id: 'voetstap', label: 'Voetstappen', color: '#ff8a75', interval: 2.9 },
  { id: 'tak', label: 'Krakende tak', color: '#b892ff', interval: 4.8 }
];

export const PROP_TYPES = [
  { id: 'boom', label: 'Bloesem / Boom', defaultY: 0 },
  { id: 'lichtbol', label: 'Lichtbol', defaultY: 1.6 },
  { id: 'poort', label: 'Lichtpoort', defaultY: 0 },
  { id: 'kampvuur', label: 'Kampvuur', defaultY: 0 },
  { id: 'zuil', label: 'Monoliet', defaultY: 0 },
  { id: 'dak', label: 'Lichtkoepel', defaultY: 2.55 }
];

export const PROP_COLORS = [
  '#ffd166', '#ff8fa3', '#5ce1b8', '#66c7ff', '#b892ff', '#f5efe6'
];

export const MAX_PROPS = 16;
export const MAX_SOUNDS = 6;

let uidCounter = 1;
export function nextId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
}

export function emptyAmbience() {
  return { vogels: 0, akkoord: 0, vuur: 0, regen: 0, wind: 0, spanning: 0 };
}

export function createCue(overrides = {}) {
  return {
    enabled: false,
    duration: 18,
    transition: 4.0,
    env: 'bos',
    color: 'zomer',
    brightness: 0.78,
    fog: 0.14,
    particles: 'bloesem',
    pulse: 0.22,
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
  zomer: {
    label: 'Zonnige tuin',
    cues: [
      createCue({
        enabled: true, duration: 15, transition: 4.0,
        env: 'bos', color: 'zomer', brightness: 0.85, fog: 0.14,
        particles: 'bloesem', pulse: 0.2,
        ambience: { ...emptyAmbience(), vogels: 0.62, akkoord: 0.42, wind: 0.2 },
        props: [
          { id: 'p_z1', type: 'boom', x: -2.4, y: 0, z: -2.8, scale: 1.15, rotY: 0.2, color: '#ff8fa3' },
          { id: 'p_z2', type: 'boom', x: 2.5, y: 0, z: -2.5, scale: 1.0, rotY: -0.4, color: '#ffd166' },
          { id: 'p_z3', type: 'poort', x: 0, y: 0, z: -3.6, scale: 1.1, rotY: 0, color: '#ffd166' }
        ],
        sounds: [
          { id: 's_z1', type: 'vogel', x: -2.2, y: 2.1, z: -2.2, volume: 0.8 },
          { id: 's_z2', type: 'klankschaal', x: 2.1, y: 1.7, z: -1.6, volume: 0.7 }
        ]
      }),
      createCue({
        enabled: true, duration: 18, transition: 4.0,
        env: 'water', color: 'pastel', brightness: 0.82, fog: 0.16,
        particles: 'bloesem', pulse: 0.3,
        ambience: { ...emptyAmbience(), vogels: 0.45, akkoord: 0.65, wind: 0.25 },
        props: [
          { id: 'p_z4', type: 'lichtbol', x: -1.7, y: 1.8, z: -2.6, scale: 1.0, rotY: 0, color: '#ffd166' },
          { id: 'p_z5', type: 'lichtbol', x: 1.8, y: 2.1, z: -2.4, scale: 0.9, rotY: 0, color: '#ff8fa3' },
          { id: 'p_z6', type: 'poort', x: 0, y: 0, z: -3.5, scale: 1.2, rotY: 0, color: '#ff8fa3' }
        ],
        sounds: [
          { id: 's_z2', type: 'klankschaal', x: 2.0, y: 1.8, z: -1.8, volume: 0.85 }
        ]
      }),
      createCue({
        enabled: true, duration: 15, transition: 4.0,
        env: 'schuilplek', color: 'lente', brightness: 0.86, fog: 0.1,
        particles: 'vuurvliegjes', pulse: 0.18,
        ambience: { ...emptyAmbience(), vogels: 0.55, akkoord: 0.48 },
        props: [
          { id: 'p_z7', type: 'boom', x: 2.3, y: 0, z: -2.7, scale: 1.1, rotY: 0, color: '#5ce1b8' }
        ],
        sounds: [
          { id: 's_z3', type: 'vogel', x: 2.0, y: 2.2, z: -2.0, volume: 0.75 }
        ]
      }),
      createCue({ enabled: false })
    ]
  },

  schuilplek: {
    label: 'Rustige schuilplek',
    cues: [
      createCue({
        enabled: true, duration: 15, transition: 4.0,
        env: 'schuilplek', color: 'warm', brightness: 0.5, fog: 0.3,
        particles: 'regen', pulse: 0.2,
        ambience: { ...emptyAmbience(), regen: 0.48, vuur: 0.35 },
        props: [
          { id: 'p_s1', type: 'kampvuur', x: 0, y: 0, z: -2.3, scale: 1.0, rotY: 0, color: '#ffd166' }
        ],
        sounds: [
          { id: 's_s1', type: 'klankschaal', x: 2.2, y: 1.5, z: -1.6, volume: 0.65 }
        ]
      }),
      createCue({
        enabled: true, duration: 20, transition: 4.0,
        env: 'schuilplek', color: 'warm', brightness: 0.68, fog: 0.2,
        particles: 'vuurvliegjes', pulse: 0.38,
        ambience: { ...emptyAmbience(), vuur: 0.58, akkoord: 0.38 },
        props: [
          { id: 'p_s1', type: 'kampvuur', x: 0, y: 0, z: -2.3, scale: 1.1, rotY: 0, color: '#ffd166' },
          { id: 'p_s2', type: 'lichtbol', x: -1.8, y: 1.6, z: -2.0, scale: 0.85, rotY: 0, color: '#ffd166' },
          { id: 'p_s3', type: 'lichtbol', x: 1.9, y: 1.8, z: -1.9, scale: 0.85, rotY: 0, color: '#5ce1b8' }
        ],
        sounds: [
          { id: 's_s1', type: 'klankschaal', x: 2.2, y: 1.5, z: -1.6, volume: 0.85 }
        ]
      }),
      createCue({
        enabled: true, duration: 15, transition: 4.0,
        env: 'water', color: 'pastel', brightness: 0.78, fog: 0.16,
        particles: 'bloesem', pulse: 0.18,
        ambience: { ...emptyAmbience(), vogels: 0.4, akkoord: 0.45 },
        props: [
          { id: 'p_s4', type: 'poort', x: 0, y: 0, z: -3.2, scale: 1.1, rotY: 0, color: '#ffd166' }
        ],
        sounds: [
          { id: 's_s2', type: 'vogel', x: -2.2, y: 1.9, z: -1.4, volume: 0.65 }
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
        env: 'hal', color: 'koel', brightness: 0.24, fog: 0.62,
        particles: 'sterren', pulse: 0.15,
        ambience: { ...emptyAmbience(), wind: 0.4, spanning: 0.38 },
        props: [
          { id: 'p_d1', type: 'zuil', x: -2.1, y: 0, z: -2.6, scale: 1.2, rotY: 0.3, color: '#66c7ff' },
          { id: 'p_d2', type: 'zuil', x: 2.1, y: 0, z: -2.6, scale: 1.2, rotY: -0.3, color: '#66c7ff' }
        ],
        sounds: [
          { id: 's_d1', type: 'voetstap', x: 0.4, y: 0.5, z: 2.7, volume: 0.78 }
        ]
      }),
      createCue({
        enabled: true, duration: 16, transition: 4.0,
        env: 'bos', color: 'koel', brightness: 0.18, fog: 0.78,
        particles: 'regen', pulse: 0.55,
        ambience: { ...emptyAmbience(), regen: 0.55, spanning: 0.62 },
        props: [
          { id: 'p_d1', type: 'zuil', x: -1.7, y: 0, z: -2.1, scale: 1.35, rotY: 0.3, color: '#b892ff' },
          { id: 'p_d2', type: 'zuil', x: 1.7, y: 0, z: -2.1, scale: 1.35, rotY: -0.3, color: '#b892ff' }
        ],
        sounds: [
          { id: 's_d1', type: 'voetstap', x: -0.6, y: 0.5, z: 2.0, volume: 0.9 },
          { id: 's_d2', type: 'tak', x: 2.1, y: 1.1, z: 1.1, volume: 0.85 }
        ]
      }),
      createCue({
        enabled: true, duration: 12, transition: 0.4,
        env: 'hal', color: 'rood', brightness: 0.58, fog: 0.55,
        particles: 'uit', pulse: 0.9,
        ambience: { ...emptyAmbience(), spanning: 0.88 },
        props: [
          { id: 'p_d4', type: 'poort', x: 0, y: 0, z: -2.5, scale: 1.3, rotY: 0, color: '#ff8fa3' },
          { id: 'p_d5', type: 'lichtbol', x: 0, y: 1.7, z: -2.5, scale: 1.3, rotY: 0, color: '#ff8fa3' }
        ],
        sounds: [
          { id: 's_d3', type: 'tak', x: 0, y: 1.4, z: -2.0, volume: 0.95 }
        ]
      }),
      createCue({
        enabled: true, duration: 14, transition: 4.0,
        env: 'water', color: 'zomer', brightness: 0.85, fog: 0.14,
        particles: 'bloesem', pulse: 0.15,
        ambience: { ...emptyAmbience(), vogels: 0.55, akkoord: 0.52 },
        props: [],
        sounds: [
          { id: 's_d4', type: 'klankschaal', x: 0, y: 1.6, z: -2.5, volume: 0.75 }
        ]
      })
    ]
  },

  lokaal: {
    label: 'MR Lokaal',
    cues: [
      createCue({
        enabled: true, duration: 15, transition: 4.0,
        env: 'hal', color: 'lente', brightness: 0.75, fog: 0.1,
        particles: 'bloesem', pulse: 0.3,
        ambience: { ...emptyAmbience(), vogels: 0.45, akkoord: 0.4 },
        props: [
          { id: 'p_m1', type: 'lichtbol', x: -1.4, y: 1.5, z: -2.0, scale: 0.8, rotY: 0, color: '#5ce1b8' },
          { id: 'p_m2', type: 'lichtbol', x: 1.5, y: 1.7, z: -1.9, scale: 0.8, rotY: 0, color: '#ffd166' }
        ],
        sounds: [
          { id: 's_m1', type: 'klankschaal', x: -1.8, y: 1.5, z: -1.5, volume: 0.7 }
        ]
      }),
      createCue({
        enabled: true, duration: 18, transition: 4.0,
        env: 'hal', color: 'pastel', brightness: 0.82, fog: 0.15,
        particles: 'vuurvliegjes', pulse: 0.5,
        ambience: { ...emptyAmbience(), akkoord: 0.58, vuur: 0.35 },
        props: [
          { id: 'p_m1', type: 'lichtbol', x: -1.4, y: 1.5, z: -2.0, scale: 1.0, rotY: 0, color: '#ff8fa3' },
          { id: 'p_m2', type: 'lichtbol', x: 1.5, y: 1.7, z: -1.9, scale: 1.0, rotY: 0, color: '#ffd166' },
          { id: 'p_m3', type: 'kampvuur', x: 0, y: 0, z: -2.1, scale: 1.0, rotY: 0, color: '#ffd166' }
        ],
        sounds: [
          { id: 's_m1', type: 'vogel', x: 1.8, y: 1.8, z: -1.5, volume: 0.8 }
        ]
      }),
      createCue({ enabled: false }),
      createCue({ enabled: false })
    ]
  }
};

export function createInitialState(presetKey = 'zomer') {
  const preset = PRESETS[presetKey] || PRESETS.zomer;
  return {
    activeCueIndex: 0,
    activeTab: 'sfeer',
    mode: 'build',
    selectedObjectId: null,
    selectedKind: null,
    cues: preset.cues.map(cloneCue)
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState('zomer');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cues) || parsed.cues.length !== 4) {
      return createInitialState('zomer');
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
    return createInitialState('zomer');
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeCueIndex: state.activeCueIndex,
      activeTab: state.activeTab,
      cues: state.cues
    }));
  } catch {}
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
