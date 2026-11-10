import { ProceduralAnimId } from '../utils/lcdGenerators';

export type RgbEffectCategory =
  | 'All'
  | 'Ambient Waves'
  | 'Static & Breathing'
  | 'Reactive Keystroke'
  | 'Particle & Matrix'
  | 'Power Saver';

export type RgbColorSupport = 'none' | 'custom' | 'built-in-rainbow' | 'palette';

export interface Gmk87LogoColorOption {
  id: number;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

export const GMK87_LOGO_MODES: Array<{ id: number; name: string; desc: string }> = [
  { id: 0, name: 'Blinking', desc: 'Single-colour blinking bar (cfg[32])' },
  { id: 1, name: 'Pulse Rainbow', desc: 'Breathing rainbow spectrum pulse' },
  { id: 2, name: 'Blinking (Alt)', desc: 'Alternate single-colour blink cadence' },
  { id: 3, name: 'Fixed', desc: 'Steady constant accent light bar' },
  { id: 4, name: 'Fixed (Alt)', desc: 'Steady high-contrast accent bar' },
];

export const GMK87_LOGO_COLORS: Gmk87LogoColorOption[] = [
  { id: 0, name: 'Red', hex: '#ef4444', rgb: [239, 68, 68] },
  { id: 1, name: 'Orange', hex: '#f97316', rgb: [249, 115, 22] },
  { id: 2, name: 'Yellow', hex: '#eab308', rgb: [234, 179, 8] },
  { id: 3, name: 'Green', hex: '#22c55e', rgb: [34, 197, 94] },
  { id: 4, name: 'Teal', hex: '#14b8a6', rgb: [20, 184, 166] },
  { id: 5, name: 'Blue', hex: '#3b82f6', rgb: [59, 130, 246] },
  { id: 6, name: 'Purple', hex: '#a855f7', rgb: [168, 85, 247] },
  { id: 7, name: 'White', hex: '#f8fafc', rgb: [248, 250, 252] },
  { id: 8, name: 'Off', hex: '#1e293b', rgb: [30, 41, 59] },
];

export interface Gmk87RgbModeDefinition {
  id: number; // 0..18 (cfg[1])
  hex: string;
  name: string;
  category: Exclude<RgbEffectCategory, 'All'>;
  desc: string;
  colorSupport: RgbColorSupport;
  isReactive?: boolean;
  supportsDirection: boolean;
  supportsCustomHue: boolean;
  supportsRainbowToggle: boolean;
  recommendedLcdAnim: ProceduralAnimId;
}

export const GMK87_ALL_19_RGB_MODES: Gmk87RgbModeDefinition[] = [
  {
    id: 1,
    hex: '0x01',
    name: 'Wave',
    category: 'Ambient Waves',
    desc: 'Horizontal dimming wave sweeping across all 87 south-facing switch LEDs and side underglow.',
    colorSupport: 'custom',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'synthwave-grid',
  },
  {
    id: 2,
    hex: '0x02',
    name: 'Colour Cloud',
    category: 'Ambient Waves',
    desc: 'Horizontal pulse wave gliding smoothly across key columns.',
    colorSupport: 'custom',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'jellyfish-glow',
  },
  {
    id: 3,
    hex: '0x03',
    name: 'Vortex',
    category: 'Ambient Waves',
    desc: 'Swirling waterfall vortex spinning across rows and columns.',
    colorSupport: 'custom',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'black-hole',
  },
  {
    id: 4,
    hex: '0x04',
    name: 'Mix Colour',
    category: 'Ambient Waves',
    desc: 'Built-in full-on cycling rainbow colours across the entire deck (ignores single colour).',
    colorSupport: 'built-in-rainbow',
    supportsDirection: false,
    supportsCustomHue: false,
    supportsRainbowToggle: false,
    recommendedLcdAnim: 'vaporwave-95',
  },
  {
    id: 5,
    hex: '0x05',
    name: 'Breathe',
    category: 'Static & Breathing',
    desc: 'Smooth sinusoidal fade-in and fade-out pulse in your calibrated single hue or rainbow cycle.',
    colorSupport: 'custom',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'ecg-pulse',
  },
  {
    id: 6,
    hex: '0x06',
    name: 'Light (Static Solid)',
    category: 'Static & Breathing',
    desc: 'Full-on constant per-key & underglow illumination using exact R/G/B register values (cfg[6..8]).',
    colorSupport: 'custom',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'cyber-hud',
  },
  {
    id: 7,
    hex: '0x07',
    name: 'Slowly Off (Reactive)',
    category: 'Reactive Keystroke',
    desc: 'Reactive mode: dark until pressed — ignites each actuated key and smoothly fades back to black.',
    colorSupport: 'custom',
    isReactive: true,
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'sandevistan-cyber',
  },
  {
    id: 8,
    hex: '0x08',
    name: 'Stone (Ripple)',
    category: 'Reactive Keystroke',
    desc: 'Reactive mode: concentric shockwave ring spreading outward from every key you press.',
    colorSupport: 'custom',
    isReactive: true,
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'bongo-cat',
  },
  {
    id: 9,
    hex: '0x09',
    name: 'Laser (Row Beam)',
    category: 'Reactive Keystroke',
    desc: 'Reactive mode: dark until pressed — fires a glowing horizontal laser wave across the pressed key row.',
    colorSupport: 'custom',
    isReactive: true,
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'gundam-lock',
  },
  {
    id: 10,
    hex: '0x0A',
    name: 'Starry',
    category: 'Particle & Matrix',
    desc: 'Stochastic twinkling keycap constellation sparkling in your single hue or rainbow.',
    colorSupport: 'custom',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'lofi-rain',
  },
  {
    id: 11,
    hex: '0x0B',
    name: 'Flowers Open',
    category: 'Ambient Waves',
    desc: 'Built-in full-on blooming rainbow colour cycle radiating across key clusters.',
    colorSupport: 'built-in-rainbow',
    supportsDirection: false,
    supportsCustomHue: false,
    supportsRainbowToggle: false,
    recommendedLcdAnim: 'kirby-dance',
  },
  {
    id: 12,
    hex: '0x0C',
    name: 'Traverse',
    category: 'Ambient Waves',
    desc: 'Built-in full-on rainbow waterfall flowing continuously down the keyboard.',
    colorSupport: 'built-in-rainbow',
    supportsDirection: true,
    supportsCustomHue: false,
    supportsRainbowToggle: false,
    recommendedLcdAnim: 'outrun-911',
  },
  {
    id: 13,
    hex: '0x0D',
    name: 'Wave Bar',
    category: 'Ambient Waves',
    desc: 'Continuous symmetrical wave originating from the center of the deck outward.',
    colorSupport: 'custom',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'outrun-911',
  },
  {
    id: 14,
    hex: '0x0E',
    name: 'Meteor',
    category: 'Particle & Matrix',
    desc: 'Circling J/K core energy that shoots streaking meteor trails outward across rows.',
    colorSupport: 'custom',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'akira-bike',
  },
  {
    id: 15,
    hex: '0x0F',
    name: 'Rain',
    category: 'Particle & Matrix',
    desc: 'Vertical cascading droplets raining down all 15 matrix columns.',
    colorSupport: 'custom',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'matrix-rain',
  },
  {
    id: 16,
    hex: '0x10',
    name: 'Scan',
    category: 'Particle & Matrix',
    desc: 'High-contrast scanner beam sweeping left and right back and forth across all rows.',
    colorSupport: 'custom',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'turbo-boost',
  },
  {
    id: 17,
    hex: '0x11',
    name: 'Trigger Colour',
    category: 'Particle & Matrix',
    desc: 'Built-in 4-colour palette cycle shifting slowly across key zones.',
    colorSupport: 'palette',
    supportsDirection: false,
    supportsCustomHue: false,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'sharingan-eye',
  },
  {
    id: 18,
    hex: '0x12',
    name: 'Center Spread',
    category: 'Ambient Waves',
    desc: 'Built-in slow outward rainbow wave expanding smoothly from the center.',
    colorSupport: 'built-in-rainbow',
    supportsDirection: false,
    supportsCustomHue: false,
    supportsRainbowToggle: false,
    recommendedLcdAnim: 'nerv-emergency',
  },
  {
    id: 0,
    hex: '0x00',
    name: 'Stealth Off (Battery Saver)',
    category: 'Power Saver',
    desc: 'Disables all 87 south-facing switch LEDs and chassis underglow to maximize 3000mAh wireless runtime.',
    colorSupport: 'none',
    supportsDirection: false,
    supportsCustomHue: false,
    supportsRainbowToggle: false,
    recommendedLcdAnim: 'flip-clock',
  },
];

export interface RgbColorwayPreset {
  id: string;
  name: string;
  subtitle: string;
  effect: number;
  brightness: number;
  speed: number;
  effectDirection: number;
  rainbowMode: number;
  r: number;
  g: number;
  b: number;
  secondaryHex: string;
  linkedLcdAnim: ProceduralAnimId;
  tag: string;
}

export const CURATED_RGB_PRESETS: RgbColorwayPreset[] = [
  {
    id: 'edgerunner',
    name: 'Cyberpunk Edgerunner',
    subtitle: 'High-voltage Night City neon cyan with Sandevistan LCD pairing',
    effect: 1, // Wave
    brightness: 4,
    speed: 3,
    effectDirection: 0,
    rainbowMode: 0,
    r: 6,
    g: 182,
    b: 212,
    secondaryHex: '#facc15',
    linkedLcdAnim: 'sandevistan-cyber',
    tag: 'Signature',
  },
  {
    id: 'gmk-laser',
    name: 'GMK Laser Synthwave',
    subtitle: 'Iconic MiTo magenta-violet pulse with 80s Outrun Sunset grid',
    effect: 13, // Neon Tide
    brightness: 4,
    speed: 2,
    effectDirection: 0,
    rainbowMode: 0,
    r: 236,
    g: 72,
    b: 153,
    secondaryHex: '#06b6d4',
    linkedLcdAnim: 'synthwave-grid',
    tag: 'Enthusiast',
  },
  {
    id: 'matrix-op',
    name: 'Matrix Operator',
    subtitle: 'Phosphor terminal emerald rain cascading down all 15 columns',
    effect: 15, // Rain (0x0F)
    brightness: 4,
    speed: 3,
    effectDirection: 0,
    rainbowMode: 0,
    r: 16,
    g: 185,
    b: 129,
    secondaryHex: '#059669',
    linkedLcdAnim: 'matrix-rain',
    tag: 'Hacker',
  },
  {
    id: 'miami-nights',
    name: 'Miami Vice 1986',
    subtitle: 'Full-spectrum rainbow wave with retro Porsche 911 Outrun telemetry',
    effect: 1, // Wave
    brightness: 4,
    speed: 2,
    effectDirection: 0,
    rainbowMode: 1,
    r: 34,
    g: 211,
    b: 238,
    secondaryHex: '#f43f5e',
    linkedLcdAnim: 'outrun-911',
    tag: 'Rainbow',
  },
  {
    id: 'eva-unit01',
    name: 'EVA-01 Biotech',
    subtitle: 'NERV purple center wave bar with emergency hex HUD alert',
    effect: 13, // Wave Bar (0x0D) — supports custom purple
    brightness: 4,
    speed: 3,
    effectDirection: 0,
    rainbowMode: 0,
    r: 168,
    g: 85,
    b: 247,
    secondaryHex: '#22c55e',
    linkedLcdAnim: 'nerv-emergency',
    tag: 'Mecha',
  },
  {
    id: 'akira-redline',
    name: 'Neo-Tokyo Redline',
    subtitle: 'Crimson meteor streaks bursting from center paired with Kaneda slide animation',
    effect: 14, // Meteor (0x0E)
    brightness: 4,
    speed: 4,
    effectDirection: 1,
    rainbowMode: 0,
    r: 239,
    g: 68,
    b: 68,
    secondaryHex: '#f97316',
    linkedLcdAnim: 'akira-bike',
    tag: 'Anime',
  },
  {
    id: 'nordic-frost',
    name: 'Glacier Arctic Ice',
    subtitle: 'Crisp sub-zero ice blue static glow for clean minimalist setups',
    effect: 6, // Solid
    brightness: 3,
    speed: 1,
    effectDirection: 0,
    rainbowMode: 0,
    r: 125,
    g: 211,
    b: 252,
    secondaryHex: '#38bdf8',
    linkedLcdAnim: 'lofi-rain',
    tag: 'Minimal',
  },
  {
    id: 'solar-campfire',
    name: 'Cozy Amber Hearth',
    subtitle: 'Warm golden-amber breathing glow paired with 240×135 pixel campfire',
    effect: 5, // Breathe
    brightness: 3,
    speed: 1,
    effectDirection: 0,
    rainbowMode: 0,
    r: 245,
    g: 158,
    b: 11,
    secondaryHex: '#ea580c',
    linkedLcdAnim: 'pixel-campfire',
    tag: 'Cozy',
  },
  {
    id: 'sakura-bloom',
    name: 'Sakura Blossom',
    subtitle: 'Soft cherry-blossom pink starry sparkles across key clusters',
    effect: 10, // Starry (0x0A) — supports custom pink
    brightness: 4,
    speed: 2,
    effectDirection: 0,
    rainbowMode: 0,
    r: 244,
    g: 114,
    b: 182,
    secondaryHex: '#fbcfe8',
    linkedLcdAnim: 'kirby-dance',
    tag: 'Pastel',
  },
  {
    id: 'deep-abyss',
    name: 'Bioluminescent Abyss',
    subtitle: 'Deep ocean indigo-cyan clouds with glowing jellyfish LCD',
    effect: 2, // Colour Cloud
    brightness: 4,
    speed: 1,
    effectDirection: 0,
    rainbowMode: 0,
    r: 56,
    g: 189,
    b: 248,
    secondaryHex: '#818cf8',
    linkedLcdAnim: 'jellyfish-glow',
    tag: 'Ambient',
  },
  {
    id: 'tactical-crosshair',
    name: 'Esports Reactive Lock',
    subtitle: 'Zero-distraction dark deck that fires cyan laser beams along the pressed key row',
    effect: 9, // Laser (0x09)
    brightness: 4,
    speed: 4,
    effectDirection: 0,
    rainbowMode: 0,
    r: 0,
    g: 245,
    b: 212,
    secondaryHex: '#3b82f6',
    linkedLcdAnim: 'gundam-lock',
    tag: 'Reactive',
  },
  {
    id: 'event-horizon',
    name: 'Gargantua Singularity',
    subtitle: 'Golden-violet relativistic vortex spinning around the G/H center',
    effect: 3, // Spiral Vortex
    brightness: 4,
    speed: 2,
    effectDirection: 1,
    rainbowMode: 0,
    r: 251,
    g: 191,
    b: 36,
    secondaryHex: '#a855f7',
    linkedLcdAnim: 'black-hole',
    tag: 'Sci-Fi',
  },
];

export interface FnLightingShortcutItem {
  id: string;
  combo: string;
  matrixPos: string;
  title: string;
  desc: string;
  registerNote: string;
  actionType:
    | 'next-effect'
    | 'next-hue'
    | 'toggle-led'
    | 'bri-up'
    | 'bri-down'
    | 'spd-down'
    | 'spd-up'
    | 'toggle-dir';
}

export const FN_LIGHTING_SHORTCUTS: FnLightingShortcutItem[] = [
  {
    id: 'fn-bslash',
    combo: 'Fn + \\|',
    matrixPos: 'L1 [2,13] · 0x5CC3',
    title: 'Cycle Lighting Effect',
    desc: 'Steps through all 19 hardware lighting modes (0x01 → 0x12)',
    registerNote: 'Increments cfg[1]',
    actionType: 'next-effect',
  },
  {
    id: 'fn-del',
    combo: 'Fn + Del',
    matrixPos: 'L1 [2,14] · 0x5CC5',
    title: 'Cycle RGB Colour / Rainbow',
    desc: 'Switches between Rainbow mode and 8 preset single-colour hues',
    registerNote: 'Updates cfg[5..8]',
    actionType: 'next-hue',
  },
  {
    id: 'fn-bspc',
    combo: 'Fn + Backspace',
    matrixPos: 'L1 [1,13] · 0x5CC2',
    title: 'Toggle All LEDs On / Off',
    desc: 'Instantly cuts or restores power to the south-facing RGB matrix',
    registerNote: 'Toggles cfg[1] ↔ 0x00',
    actionType: 'toggle-led',
  },
  {
    id: 'fn-up',
    combo: 'Fn + ↑ Up',
    matrixPos: 'L1 [4,13] · 0x5CC9',
    title: 'Brightness Increase (+)',
    desc: 'Raises LED PWM duty cycle up to level 9 maximum',
    registerNote: 'cfg[2] = min(9, cfg[2]+1)',
    actionType: 'bri-up',
  },
  {
    id: 'fn-down',
    combo: 'Fn + ↓ Down',
    matrixPos: 'L1 [6,12] · 0x5CCA',
    title: 'Brightness Decrease (-)',
    desc: 'Dims LED PWM duty cycle down to 0',
    registerNote: 'cfg[2] = max(0, cfg[2]-1)',
    actionType: 'bri-down',
  },
  {
    id: 'fn-left',
    combo: 'Fn + ← Left',
    matrixPos: 'L1 [5,13] · 0x5CCC',
    title: 'Effect Speed Slower (-)',
    desc: 'Slows down animation cadence (cfg[3] increments toward 4 = slowest)',
    registerNote: 'cfg[3] = min(4, cfg[3]+1)',
    actionType: 'spd-down',
  },
  {
    id: 'fn-right',
    combo: 'Fn + → Right',
    matrixPos: 'L1 [6,13] · 0x5CCB',
    title: 'Effect Speed Faster (+)',
    desc: 'Accelerates animation cadence (cfg[3] decrements toward 0 = fastest)',
    registerNote: 'cfg[3] = max(0, cfg[3]-1)',
    actionType: 'spd-up',
  },
  {
    id: 'fn-dir',
    combo: 'Fn + Ins / Dir',
    matrixPos: 'cfg[4] Register',
    title: 'Reverse Wave / Spin Direction',
    desc: 'Flips horizontal wave, spiral vortex, and meteor trajectory',
    registerNote: 'cfg[4] = cfg[4] ^ 1',
    actionType: 'toggle-dir',
  },
];

/**
 * Helper: Convert HSL (h: 0..360, s: 0..100, l: 0..100) to [r, g, b] (0..255)
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hn < 60) {
    r1 = c;
    g1 = x;
  } else if (hn < 120) {
    r1 = x;
    g1 = c;
  } else if (hn < 180) {
    g1 = c;
    b1 = x;
  } else if (hn < 240) {
    g1 = x;
    b1 = c;
  } else if (hn < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

/**
 * Helper: Convert RGB (0..255) to [h (0..360), s (0..100), v (0..100)]
 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : Math.round((d / max) * 100);
  const v = Math.round(max * 100);
  return [h, s, v];
}

/**
 * Helper: Convert HSV (h: 0..360, s: 0..100, v: 0..100) to [r, g, b]
 */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const vn = Math.max(0, Math.min(100, v)) / 100;

  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hn < 60) {
    r1 = c;
    g1 = x;
  } else if (hn < 120) {
    r1 = x;
    g1 = c;
  } else if (hn < 180) {
    g1 = c;
    b1 = x;
  } else if (hn < 240) {
    g1 = x;
    b1 = c;
  } else if (hn < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

export interface KeyRippleEvent {
  x: number;
  y: number;
  row: number;
  col: number;
  timestamp: number;
}

const BUILT_IN_RAINBOW_EFFECTS = new Set([4, 11, 12, 18]);

function isEffectBuiltInRainbow(effect: number): boolean {
  return BUILT_IN_RAINBOW_EFFECTS.has(effect);
}

/**
 * Computes the instantaneous [R, G, B, intensity(0..1)] of a physical keycap on the 87-key TKL deck
 * for any of the 19 GMK87 firmware modes (0..18).
 */
export function computePerKeyShader(params: {
  keyX: number; // 0..18.25 physical units
  keyY: number; // 0..6.5 physical units
  row: number;
  col: number;
  effect: number; // 0..18
  brightness: number; // 0..4
  speed: number; // UI 0 (slowest) .. 4 (fastest)
  direction: number; // 0 or 1
  rainbow: number; // 0 or 1
  baseR: number;
  baseG: number;
  baseB: number;
  timeSec: number;
  ripples: KeyRippleEvent[];
}): { r: number; g: number; b: number; alpha: number } {
  const {
    keyX,
    keyY,
    row,
    col,
    effect,
    brightness,
    speed,
    direction,
    rainbow,
    baseR,
    baseG,
    baseB,
    timeSec,
    ripples,
  } = params;

  if (effect === 0 || brightness <= 0) {
    return { r: 0, g: 0, b: 0, alpha: 0 };
  }

  const briScale = Math.max(0.14, Math.min(1, 0.14 + ((brightness - 1) / 3) * 0.86));
  const spdMul = 0.55 + Math.max(0, Math.min(4, speed)) * 0.55;
  const dirSign = direction ? -1 : 1;
  const t = timeSec * spdMul * dirSign;
  const absT = timeSec * spdMul;

  const [baseHue] = rgbToHsv(baseR, baseG, baseB);
  const centerX = 8.8;
  const centerY = 3.2;
  const dx = keyX - centerX;
  const dy = keyY - centerY;
  const distCenter = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const effectiveRainbow = Boolean(rainbow) || isEffectBuiltInRainbow(effect);

  const pickColor = (
    phaseHueOffset: number,
    intensity = 1,
    minFloor = 0.08
  ): { r: number; g: number; b: number; alpha: number } => {
    const clampedInt = Math.max(minFloor, Math.min(1, intensity)) * briScale;
    if (clampedInt <= 0.005) {
      return { r: 0, g: 0, b: 0, alpha: 0 };
    }
    if (effectiveRainbow) {
      const [rr, gg, bb] = hslToRgb(phaseHueOffset, 95, 56);
      return {
        r: Math.round(rr * clampedInt),
        g: Math.round(gg * clampedInt),
        b: Math.round(bb * clampedInt),
        alpha: clampedInt,
      };
    }
    return {
      r: Math.round(baseR * clampedInt),
      g: Math.round(baseG * clampedInt),
      b: Math.round(baseB * clampedInt),
      alpha: clampedInt,
    };
  };

  switch (effect) {
    case 1: {
      // 0x01 Wave: Horizontal dimming wave
      const wavePhase = keyX * 22 - t * 115;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((wavePhase * Math.PI) / 180));
      return pickColor(wavePhase, effectiveRainbow ? 0.92 : pulse);
    }
    case 2: {
      // 0x02 Colour Cloud: Horizontal pulse wave
      const p1 = Math.sin(keyX * 0.45 - t * 1.9);
      const p2 = Math.cos(keyY * 0.65 - t * 1.2);
      const norm = (p1 + p2 + 2) / 4;
      return pickColor(baseHue + norm * 160 + t * 45, 0.35 + 0.65 * norm);
    }
    case 3: {
      // 0x03 Vortex: Swirling waterfall/vortex
      const spiral = angleDeg + distCenter * 28 - t * 140;
      const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((spiral * Math.PI) / 180));
      return pickColor(spiral, effectiveRainbow ? 0.92 : pulse);
    }
    case 4: {
      // 0x04 Mix Colour (Built-In Rainbow): Full-on cycling colours
      const cycleHue = (keyX * 14 + keyY * 18 - absT * 95) % 360;
      return pickColor(cycleHue, 0.95);
    }
    case 5: {
      // 0x05 Breathe: Smooth sinusoidal fade
      const breathe = 0.1 + 0.9 * (0.5 + 0.5 * Math.sin(absT * 2.4));
      return pickColor(baseHue + absT * 36, breathe, 0.02);
    }
    case 6: {
      // 0x06 Light: Calibrated static solid (or full-on rainbow if RNBW toggled)
      return pickColor(baseHue + keyX * 18, 1.0);
    }
    case 7: {
      // 0x07 Slowly Off: Reactive — pressed key lights and fades back to off
      let glow = 0.0;
      const nowMs = performance.now();
      for (const rp of ripples) {
        if (rp.row === row && rp.col === col) {
          const ageSec = (nowMs - rp.timestamp) / 1000;
          const fadeSec = 1.6 / Math.max(0.5, spdMul * 0.7);
          if (ageSec < fadeSec) {
            glow = Math.max(glow, 1 - ageSec / fadeSec);
          }
        }
      }
      if (ripples.length === 0) {
        const demoCol = Math.floor((absT * 3.5) % 15);
        const demoRow = Math.floor((absT * 1.4) % 6);
        if (col === demoCol && row === demoRow) glow = 0.75;
      }
      return pickColor(baseHue + (row * 25 + col * 15), glow, 0);
    }
    case 8: {
      // 0x08 Stone: Reactive — glow spreading outward as ripple from pressed key
      let maxRipple = 0;
      let rippleHue = baseHue;
      const nowMs = performance.now();
      for (const rp of ripples) {
        const ageSec = (nowMs - rp.timestamp) / 1000;
        if (ageSec > 1.6) continue;
        const d = Math.hypot(keyX - rp.x, keyY - rp.y);
        const radius = ageSec * (6 + speed * 2.2);
        const ring = Math.max(0, 1 - Math.abs(d - radius) / 1.85) * (1 - ageSec / 1.6);
        if (ring > maxRipple) {
          maxRipple = ring;
          rippleHue = baseHue + d * 24;
        }
      }
      if (ripples.length === 0 && maxRipple < 0.05) {
        const idleRadius = (absT * 3.2) % 12;
        maxRipple = Math.max(0, 0.55 * (1 - Math.min(1, Math.abs(distCenter - idleRadius) / 2.0)));
        rippleHue = baseHue + distCenter * 20;
      }
      return pickColor(rippleHue, maxRipple, 0);
    }
    case 9: {
      // 0x09 Laser: Reactive — glow spreading along row of pressed key
      let beam = 0;
      const nowMs = performance.now();
      for (const rp of ripples) {
        const ageSec = (nowMs - rp.timestamp) / 1000;
        if (ageSec < 1.2 && rp.row === row) {
          const spreadDist = ageSec * (11 + speed * 3.0);
          const d = Math.abs(keyX - rp.x);
          const front = Math.max(0, 1 - Math.abs(d - spreadDist) / 3.2) * (1 - ageSec / 1.2);
          beam = Math.max(beam, front);
        }
      }
      if (ripples.length === 0) {
        const activeRow = Math.floor((absT * 1.4) % 6);
        const beamX = ((absT * 8.5) % 19);
        if (row === activeRow) {
          beam = Math.max(0, 0.78 * (1 - Math.abs(keyX - beamX) / 4.0));
        }
      }
      return pickColor(baseHue + keyX * 14, beam, 0);
    }
    case 10: {
      // 0x0A Starry: Stochastic twinkling keys
      const seed = Math.sin((row * 17 + col * 31 + 1) * 12.9898) * 43758.5453;
      const phase = (seed - Math.floor(seed)) * Math.PI * 2;
      const twinkle = Math.pow(0.5 + 0.5 * Math.sin(absT * 3.1 + phase), 3);
      return pickColor(baseHue + (row * 25 + col * 14), twinkle, 0.05);
    }
    case 11: {
      // 0x0B Flowers Open (Built-In Rainbow): Full-on blooming rainbow cycle
      const bloom = Math.sin(keyX * 0.55 + absT * 2.1) * Math.cos(keyY * 0.65 - absT * 1.8);
      const hue = (absT * 75 + distCenter * 24 + bloom * 90) % 360;
      return pickColor(hue, 0.72 + 0.28 * Math.abs(bloom));
    }
    case 12: {
      // 0x0C Traverse (Built-In Rainbow): Full-on rainbow waterfall
      const wfHue = (keyY * 38 + keyX * 12 - t * 120) % 360;
      return pickColor(wfHue, 0.94);
    }
    case 13: {
      // 0x0D Wave Bar: Continuous wave originating from center
      const edgeDist = Math.abs(keyX - centerX);
      const tidePhase = edgeDist * 35 - t * 130;
      const wave = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin((tidePhase * Math.PI) / 180));
      return pickColor(tidePhase + baseHue, wave);
    }
    case 14: {
      // 0x0E Meteor: Circling J/K core then shooting outward across rows
      const jkX = 7.75;
      const jkY = 3.35;
      const dJk = Math.hypot(keyX - jkX, keyY - jkY);
      const trailRadius = ((absT * 5.2) % 14);
      const ring = Math.max(0.08, 1 - Math.abs(dJk - trailRadius) / 2.4);
      const headX = (((t * 7.5 + row * 3.7) % 20) + 20) % 20 - 2;
      const trailDist = direction ? keyX - headX : headX - keyX;
      const tail = trailDist >= 0 && trailDist < 4.5 ? 1 - trailDist / 4.5 : 0.08;
      return pickColor(baseHue + dJk * 24 + t * 25, Math.max(ring * 0.85, tail));
    }
    case 15: {
      // 0x0F Rain: Vertical droplets raining down 15 columns
      const colSeed = ((col * 7 + 3) % 11) * 0.65;
      const dropY = (((t * 3.8 + colSeed) % 9) + 9) % 9 - 1.5;
      const distY = direction ? keyY - dropY : dropY - keyY;
      const glow = distY >= 0 && distY < 3.2 ? 1 - distY / 3.2 : 0.06;
      return pickColor(baseHue + col * 22 + t * 35, glow);
    }
    case 16: {
      // 0x10 Scan: Left-to-right bouncing beam
      const scanX = 9.0 + Math.sin(absT * 2.2) * 8.6;
      const prox = Math.max(0.06, 1 - Math.abs(keyX - scanX) / 2.8);
      return pickColor(baseHue + keyX * 16 + absT * 30, prox);
    }
    case 17: {
      // 0x11 Trigger Colour (4-colour built-in palette cycle)
      const paletteHues = [0, 52, 145, 215]; // Red, Yellow, Green, Blue
      const step = absT * 0.9 + keyX * 0.14 + keyY * 0.12;
      const idx = Math.floor(step) % paletteHues.length;
      const hue = effectiveRainbow
        ? (step * 45) % 360
        : paletteHues[((idx % paletteHues.length) + paletteHues.length) % paletteHues.length];
      return pickColor(hue, 0.88);
    }
    case 18:
    default: {
      // 0x12 Center Spread (Built-In Rainbow): Slow outward rainbow wave from center
      const hue = (distCenter * 30 - absT * 75) % 360;
      return pickColor(hue, 0.92);
    }
  }
}

export interface ChassisUnderglowVisuals {
  isOff: boolean;
  borderColor: string;
  boxShadow: string;
  topGradient: string;
  bottomGradient: string;
  leftGradient: string;
  rightGradient: string;
  stripOpacity: number;
}

function sampleShaderEdgeGradient(
  directionCss: string,
  points: Array<{ keyX: number; keyY: number; row: number; col: number }>,
  baseParams: {
    effect: number;
    brightness: number;
    speed: number;
    direction: number;
    rainbow: number;
    baseR: number;
    baseG: number;
    baseB: number;
    timeSec: number;
    ripples: KeyRippleEvent[];
  }
): string {
  const stops = points.map((pt, i) => {
    const shade = computePerKeyShader({
      ...baseParams,
      keyX: pt.keyX,
      keyY: pt.keyY,
      row: pt.row,
      col: pt.col,
    });
    // Guarantee edge glow visibly pops for dark active colors while dropping to dark when shader is unlit
    const pct = Math.round((i / Math.max(1, points.length - 1)) * 100);
    return `rgb(${shade.r}, ${shade.g}, ${shade.b}) ${pct}%`;
  });
  return `linear-gradient(${directionCss}, ${stops.join(', ')})`;
}

/**
 * Shared 360-degree perimeter diffuser strip + chassis halo visual calculator
 * used by both Tab 1 (Key Remapper) and Tab 7 (RGB & Underglow Studio).
 */
export function computeChassisUnderglowVisuals(params: {
  effect: number;
  brightness: number;
  speed: number;
  direction: number;
  rainbow: number;
  baseR: number;
  baseG: number;
  baseB: number;
  timeSec: number;
  ripples: KeyRippleEvent[];
}): ChassisUnderglowVisuals {
  const { effect, brightness } = params;
  if (effect === 0 || brightness <= 0) {
    return {
      isOff: true,
      borderColor: '#1e293b',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      topGradient: 'linear-gradient(90deg, #0f172a, #0f172a)',
      bottomGradient: 'linear-gradient(90deg, #0f172a, #0f172a)',
      leftGradient: 'linear-gradient(180deg, #0f172a, #0f172a)',
      rightGradient: 'linear-gradient(180deg, #0f172a, #0f172a)',
      stripOpacity: 0,
    };
  }

  const topPoints = [
    { keyX: 0.5, keyY: 0.4, row: 0, col: 0 },
    { keyX: 5.5, keyY: 0.4, row: 0, col: 5 },
    { keyX: 11.5, keyY: 0.4, row: 0, col: 10 },
    { keyX: 17.5, keyY: 0.4, row: 0, col: 14 },
  ];
  const bottomPoints = [
    { keyX: 0.5, keyY: 5.8, row: 5, col: 0 },
    { keyX: 5.5, keyY: 5.8, row: 5, col: 5 },
    { keyX: 11.5, keyY: 5.8, row: 5, col: 10 },
    { keyX: 17.5, keyY: 5.8, row: 5, col: 14 },
  ];
  const leftPoints = [
    { keyX: 0.4, keyY: 0.5, row: 0, col: 0 },
    { keyX: 0.4, keyY: 3.2, row: 3, col: 0 },
    { keyX: 0.4, keyY: 5.8, row: 5, col: 0 },
  ];
  const rightPoints = [
    { keyX: 17.8, keyY: 0.5, row: 0, col: 14 },
    { keyX: 17.8, keyY: 3.2, row: 3, col: 14 },
    { keyX: 17.8, keyY: 5.8, row: 5, col: 14 },
  ];

  const cLeft = computePerKeyShader({ ...params, keyX: 1.5, keyY: 3.2, row: 3, col: 1 });
  const cMid = computePerKeyShader({ ...params, keyX: 9.0, keyY: 3.2, row: 3, col: 7 });
  const cRight = computePerKeyShader({ ...params, keyX: 16.5, keyY: 3.2, row: 3, col: 13 });

  const briNorm = Math.max(0.16, Math.min(1, 0.16 + ((brightness - 1) / 8) * 0.84));
  const avgAlpha = Math.max(cLeft.alpha, cMid.alpha, cRight.alpha);
  const haloAlpha = Math.max(0.06, Math.min(0.85, avgAlpha * 0.85));

  // Choose brightest corner/center color for crisp border highlight
  const borderCol =
    cMid.r + cMid.g + cMid.b >= cLeft.r + cLeft.g + cLeft.b ? cMid : cLeft;
  const borderColor =
    avgAlpha <= 0.04
      ? 'rgba(30, 41, 59, 0.85)'
      : `rgba(${Math.min(255, Math.round(borderCol.r / briNorm))}, ${Math.min(
          255,
          Math.round(borderCol.g / briNorm)
        )}, ${Math.min(255, Math.round(borderCol.b / briNorm))}, ${Math.max(0.28, haloAlpha)})`;

  return {
    isOff: false,
    borderColor,
    boxShadow: `-18px 0 44px rgba(${cLeft.r}, ${cLeft.g}, ${cLeft.b}, ${haloAlpha}), 18px 0 44px rgba(${cRight.r}, ${cRight.g}, ${cRight.b}, ${haloAlpha}), 0 0 72px rgba(${cMid.r}, ${cMid.g}, ${cMid.b}, ${haloAlpha * 0.72}), inset 0 0 26px rgba(${cMid.r}, ${cMid.g}, ${cMid.b}, ${haloAlpha * 0.35})`,
    topGradient: sampleShaderEdgeGradient('90deg', topPoints, params),
    bottomGradient: sampleShaderEdgeGradient('90deg', bottomPoints, params),
    leftGradient: sampleShaderEdgeGradient('180deg', leftPoints, params),
    rightGradient: sampleShaderEdgeGradient('180deg', rightPoints, params),
    stripOpacity: Math.max(0.15, Math.min(0.96, briNorm * Math.max(0.35, avgAlpha / briNorm))),
  };
}

/**
 * Computes CSS background & glow for the GMK87 Nav-Cluster Logo LED Strip (cfg[28..32]).
 */
export function computeLogoBarVisual(params: {
  logoMode?: number;
  logoBrightness?: number;
  logoRainbow?: number;
  logoColor?: number;
  timeSec: number;
}): { background: string; boxShadow: string; opacity: number; title: string } {
  const mode = params.logoMode ?? 0;
  const bri = params.logoBrightness ?? 9;
  const isRainbow = Boolean(params.logoRainbow) || mode === 1;
  const colorIdx = Math.max(0, Math.min(8, params.logoColor ?? 0));
  const colorDef = GMK87_LOGO_COLORS[colorIdx] || GMK87_LOGO_COLORS[0];

  if (bri <= 0 || (!isRainbow && colorIdx === 8)) {
    return {
      background: '#0f172a',
      boxShadow: 'none',
      opacity: 0.45,
      title: `GMK87 Logo Light Bar (OFF · Bri ${bri}/9 · Color ${colorDef.name})`,
    };
  }

  const briScale = Math.max(0.18, Math.min(1, bri / 9));
  let pulse = 1;
  if (mode === 0 || mode === 2) {
    // Blinking modes
    const freq = mode === 2 ? 4.2 : 2.6;
    pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(params.timeSec * freq));
  } else if (mode === 1) {
    // Pulse rainbow
    pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(params.timeSec * 2.2));
  }

  const modeLabel = GMK87_LOGO_MODES[mode]?.name || `Mode ${mode}`;

  if (isRainbow) {
    const hShift = Math.round((params.timeSec * 90) % 360);
    const [r1, g1, b1] = hslToRgb(hShift, 95, 58);
    const [r2, g2, b2] = hslToRgb((hShift + 110) % 360, 95, 58);
    const [r3, g3, b3] = hslToRgb((hShift + 220) % 360, 95, 58);
    const alpha = Math.max(0.2, Math.min(0.95, briScale * pulse));
    return {
      background: `linear-gradient(90deg, rgb(${r1},${g1},${b1}), rgb(${r2},${g2},${b2}), rgb(${r3},${g3},${b3}))`,
      boxShadow: `0 0 18px rgba(${r2},${g2},${b2},${alpha}), 0 0 28px rgba(${r1},${g1},${b1},${alpha * 0.75})`,
      opacity: alpha,
      title: `GMK87 Logo Light Bar (${modeLabel} · Rainbow · Bri ${bri}/9)`,
    };
  }

  const [rr, gg, bb] = colorDef.rgb;
  const alpha = Math.max(0.2, Math.min(0.95, briScale * pulse));
  return {
    background: colorDef.hex,
    boxShadow: `0 0 18px rgba(${rr},${gg},${bb},${alpha}), 0 0 28px rgba(${rr},${gg},${bb},${alpha * 0.65})`,
    opacity: alpha,
    title: `GMK87 Logo Light Bar (${modeLabel} · ${colorDef.name} · Bri ${bri}/9)`,
  };
}
