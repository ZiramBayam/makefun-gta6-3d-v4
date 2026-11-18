// Cielo Bay: Solar Noir — immutable tuning values shared by every module.
export const SEED = 20261118;
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;
export const VIEW = { width: 1280, height: 720 };
export const SAVE_KEY = 'cielo-bay-3d-save';

export const CITY = { block: 160, cols: 9, rows: 9, harborX: 6, harborZ: 2 };

// Hex integers are consumed directly by the renderer; cssColor makes canvas textures.
export const PALETTE = {
  ivory: 0xe8ddc4,
  terracotta: 0xc96f4a,
  coral: 0xff6b4a,
  seaGlass: 0x5ce0c6,
  glassBlue: 0x7fb8c9,
  deepShadow: 0x071a24,
  sunGold: 0xffd166,
  paving: 0xf2e8d2,
  asphalt: 0x8d7f70,
  sidewalk: 0xe4d6b8,
  roof: 0xa95338,
  leaf: 0x467d51,
  water: 0x36a89f,
  glassTint: 0x9fc9d2,
  white: 0xf7f1e3,
  policeBlue: 0x35608a,
};

export const cssColor = (hex) => '#' + (hex >>> 0).toString(16).padStart(6, '0');

export const DISTRICTS = [
  { name: 'Marisol Rows', color: 0xd98a63 },
  { name: 'Palma Vista', color: 0xe0b04f },
  { name: 'Puerto Alto', color: 0x5fc3b0 },
  { name: 'Coral Causeway', color: 0xe07a6a },
  { name: 'Old Customs House', color: 0xc9a06a },
  { name: 'Solano Plaza', color: 0x8fb9c9 },
  { name: 'Glass Mile', color: 0x7fb8c9 },
  { name: 'Seawall South', color: 0x4fa8a0 },
];

export const MISSIONS = [
  {
    title: 'A Small Favour',
    brief: 'Nia Vale left a parcel in Marisol Rows. Collect it, then take it to Solano Plaza.',
    reward: 750,
    kind: 'delivery',
    dialogue: [
      { who: 'Nia Vale', text: 'Courier work. Quiet, simple, paid. Collect the parcel and bring it to me at Solano Plaza.' },
      { who: 'Nia Vale', text: 'Keep your head down and follow the gold light.' },
    ],
  },
  {
    title: 'The Harbour Van',
    brief: 'Ines Marlow needs a van lifted from the harbour pier. Two crew are guarding it. Drive it to the garage in Puerto Alto.',
    reward: 1400,
    kind: 'theft',
    dialogue: [
      { who: 'Ines Marlow', text: 'The van is down by the pier. Two of Rafa’s men are watching it.' },
      { who: 'Ines Marlow', text: 'Take it to the Puerto Alto garage. Try not to make a story of it.' },
    ],
  },
  {
    title: 'Causeway Runner',
    brief: 'Rafa Solis wants a runner stopped on the Coral Causeway before he reaches the plaza.',
    reward: 1800,
    kind: 'chase',
    dialogue: [
      { who: 'Rafa Solis', text: 'There he is, heading for the causeway. Catch him before he melts into the traffic.' },
    ],
  },
  {
    title: 'The Plaza Reckoning',
    brief: 'Ada Cruz is waiting at Solano Plaza. Four gangsters are waiting with her. Clear the plaza.',
    reward: 3500,
    kind: 'fight',
    dialogue: [
      { who: 'Ada Cruz', text: 'I asked them to talk. They brought four friends instead.' },
      { who: 'Ada Cruz', text: 'Stay behind me. If one gets through, you finish it.' },
    ],
  },
];

// Menu actions are owned in one place so the renderer and the HUD agree.
export const BUTTON_IDS = ['play', 'continue', 'controls', 'back', 'resume', 'save', 'mute', 'restart'];
