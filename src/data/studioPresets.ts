export type KeycapThemeId = 'cyberpunk' | 'olivia' | 'laser' | 'botanical' | 'dolch';

export type TabId =
  | 'keymap'
  | 'gifs'
  | 'shortcuts'
  | 'clock'
  | 'telemetry'
  | 'uploader'
  | 'rgb'
  | 'knob'
  | 'ecosystem';

export interface WebGifItem {
  id: string;
  title: string;
  url: string;
  preview: string;
  source: string;
  width: number;
  height: number;
}

export const KATAKANA_SUBLEGENDS: Record<string, string> = {
  '`': 'ろ',
  '~': 'ろ',
  '~ `': 'ろ',
  '1': 'ヌ',
  '2': 'フ',
  '3': 'ア',
  '4': 'ウ',
  '5': 'エ',
  '6': 'オ',
  '7': 'ヤ',
  '8': 'ユ',
  '9': 'ヨ',
  '0': 'ワ',
  '-': 'ホ',
  '=': 'ヘ',
  'Q': 'タ',
  'W': 'テ',
  'E': 'イ',
  'R': 'ス',
  'T': 'カ',
  'Y': 'ン',
  'U': 'ナ',
  'I': 'ニ',
  'O': 'ラ',
  'P': 'セ',
  '[': '゛',
  ']': '゜',
  '\\': 'ム',
  'A': 'チ',
  'S': 'ト',
  'D': 'シ',
  'F': 'ハ',
  'G': 'キ',
  'H': 'ク',
  'J': 'マ',
  'K': 'ノ',
  'L': 'リ',
  ';': 'レ',
  "'": 'ケ',
  'Z': 'ツ',
  'X': 'サ',
  'C': 'ソ',
  'V': 'ヒ',
  'B': 'コ',
  'N': 'ミ',
  'M': 'モ',
  ',': 'ネ',
  '.': 'ル',
  '/': 'メ',
};

export const CYBER_MOD_GLYPHS: Record<string, string> = {
  r0c0: '△', // Esc - Red Tech Triangle
  r0c13: '⊕', // PrtSc - Crosshair Target
  r1c13: '<<<<<<', // Backspace - Cyan Chevron Gauge
  r2c0: '[-==--]', // Tab
  r3c0: '[++++]', // Caps Lock
  r3c13: '∿∿∿∿∿', // Enter - Red Waveform
  r4c0: '[==---]', // LShift
  r4c12: '[+ ++ ---]', // RShift
  r5c0: '☵', // LCtrl
  r5c1: '❖', // Win
  r5c2: '▲▼', // LAlt
  r5c9: '▲▼', // RAlt
  r5c10: 'FN', // Fn
  r5c11: '🗲', // Menu
  r5c12: '☵', // RCtrl
  // Nav Cluster
  r1c14: '⤾', // Ins
  r3c14: '☊', // Home
  r5c14: '⤿', // PgUp
  r2c14: '※', // Del
  r4c14: '≈', // End
  r6c14: '⛶', // PgDn
};

export const GMK_KEYCAP_THEMES: Record<
  KeycapThemeId,
  {
    name: string;
    badge: string;
    alphaClass: string;
    modClass: string;
    accentClass: string;
    legendColor: string;
  }
> = {
  cyberpunk: {
    name: 'GMK Awaken (Yellow Space)',
    badge: '#facc15',
    alphaClass:
      'bg-gradient-to-b from-[#141824] via-[#0d111c] to-[#070a12] border border-[#232c40] text-yellow-300',
    modClass:
      'bg-gradient-to-b from-[#101522] via-[#0b0e18] to-[#060810] border border-[#1b253b] text-cyan-400',
    accentClass:
      'bg-gradient-to-b from-[#ef4444] to-[#b91c1c] border border-red-400 text-white font-bold',
    legendColor: 'text-yellow-300',
  },
  olivia: {
    name: 'GMK Olivia++',
    badge: '#e8b4b8',
    alphaClass:
      'bg-gradient-to-b from-[#332f31] via-[#262325] to-[#1c1a1b] border border-[#474144] text-[#f7ecec]',
    modClass:
      'bg-gradient-to-b from-[#1f1d1e] via-[#161415] to-[#0e0d0e] border border-[#332f31] text-[#f4bcc0]',
    accentClass:
      'bg-gradient-to-b from-[#e8b4b8] to-[#d69fa4] border border-[#fce4e6] text-[#1a1718] font-bold',
    legendColor: 'text-[#f7ecec]',
  },
  laser: {
    name: 'GMK Laser Synth',
    badge: '#f43f5e',
    alphaClass:
      'bg-gradient-to-b from-[#261854] via-[#1a0f3d] to-[#10072b] border border-[#442c94] text-[#22d3ee]',
    modClass:
      'bg-gradient-to-b from-[#170a36] via-[#0e0524] to-[#080217] border border-[#331773] text-[#f43f5e]',
    accentClass:
      'bg-gradient-to-b from-[#f43f5e] to-[#be123c] border border-[#fda4af] text-white font-bold',
    legendColor: 'text-[#22d3ee]',
  },
  botanical: {
    name: 'GMK Botanical',
    badge: '#10b981',
    alphaClass:
      'bg-gradient-to-b from-[#223d34] via-[#172c25] to-[#0f1f1a] border border-[#355c4f] text-[#ecfdf5]',
    modClass:
      'bg-gradient-to-b from-[#13241e] via-[#0b1814] to-[#06100d] border border-[#203a31] text-[#6ee7b7]',
    accentClass:
      'bg-gradient-to-b from-[#10b981] to-[#047857] border border-[#6ee7b7] text-slate-950 font-bold',
    legendColor: 'text-[#ecfdf5]',
  },
  dolch: {
    name: 'GMK Retro Dolch',
    badge: '#f59e0b',
    alphaClass:
      'bg-gradient-to-b from-[#3c434d] via-[#2c323b] to-[#1f242b] border border-[#535c69] text-slate-100',
    modClass:
      'bg-gradient-to-b from-[#22272e] via-[#171b21] to-[#0f1216] border border-[#373e4a] text-amber-300',
    accentClass:
      'bg-gradient-to-b from-[#ef4444] to-[#b91c1c] border border-[#fca5a5] text-white font-bold',
    legendColor: 'text-slate-100',
  },
};

export const WEB_GIF_CATEGORIES = [
  { label: 'Cyberpunk', query: 'cyberpunk neon' },
  { label: 'Trending', query: 'trending aesthetic' },
  { label: 'Anime', query: 'anime' },
  { label: 'Pixel Art', query: 'pixel art' },
  { label: 'Gaming', query: 'retro gaming arcade' },
  { label: 'Lo-Fi', query: 'lofi chill' },
  { label: 'Space', query: 'space nebula galaxy' },
  { label: 'Vaporwave', query: 'vaporwave synthwave' },
  { label: 'Sci-Fi', query: 'scifi hud hologram' },
  { label: 'Nature', query: 'nature waterfalls rain' },
  { label: 'Cars', query: 'jdm sports car drift' },
  { label: 'Cats', query: 'funny cute cat' },
  { label: 'Pokémon', query: 'pokemon sprite' },
];

export const SMART_KNOB_MODES = [
  {
    id: 'volume',
    title: '🔊 System Volume',
    subtitle: 'Standard master audio control',
    ccwCode: 0x00aa, // VOL-
    cwCode: 0x00a9, // VOL+
    clickCode: 0x00a8, // MUTE
    ccwLabel: 'VOL -',
    clickLabel: 'MUTE',
    cwLabel: 'VOL +',
    accent: '#06b6d4',
  },
  {
    id: 'media',
    title: '🎵 Media Player',
    subtitle: 'Playlist transport & track skip',
    ccwCode: 0x00ac, // PREV
    cwCode: 0x00ab, // NEXT
    clickCode: 0x00ae, // PLAY/PAUSE
    ccwLabel: 'PREV',
    clickLabel: 'PLAY',
    cwLabel: 'NEXT',
    accent: '#10b981',
  },
  {
    id: 'scrubber',
    title: '⏩ Timeline Scrubber',
    subtitle: 'Frame/timeline jog for video & code',
    ccwCode: 0x0050, // LEFT
    cwCode: 0x004f, // RIGHT
    clickCode: 0x002c, // SPACE
    ccwLabel: 'STEP ◄',
    clickLabel: 'SPACE',
    cwLabel: 'STEP ►',
    accent: '#8b5cf6',
  },
  {
    id: 'zoom',
    title: '🔍 Zoom & Navigation',
    subtitle: 'Canvas & browser zoom control',
    ccwCode: 0x012d, // Ctrl -
    cwCode: 0x012e, // Ctrl +
    clickCode: 0x0127, // Ctrl 0
    ccwLabel: 'ZOOM -',
    clickLabel: '100%',
    cwLabel: 'ZOOM +',
    accent: '#f59e0b',
  },
] as const;

export type SmartKnobMode = (typeof SMART_KNOB_MODES)[number];

export interface PomodoroState {
  running: boolean;
  targetEndMs: number;
  pausedSeconds: number;
}

export function computePomodoroRemainingSeconds(state: PomodoroState): number {
  if (!state.running) return Math.max(0, state.pausedSeconds);
  return Math.max(0, Math.ceil((state.targetEndMs - Date.now()) / 1000));
}
