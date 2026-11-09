import { ProceduralAnimId } from '../utils/lcdGenerators';

export type RgbEffectCategory =
  | 'All'
  | 'Ambient Waves'
  | 'Static & Breathing'
  | 'Reactive Keystroke'
  | 'Particle & Matrix'
  | 'Power Saver';

export interface Gmk87RgbModeDefinition {
  id: number; // 0..18 (cfg[1])
  hex: string;
  name: string;
  category: Exclude<RgbEffectCategory, 'All'>;
  desc: string;
  supportsDirection: boolean;
  supportsCustomHue: boolean;
  supportsRainbowToggle: boolean;
  recommendedLcdAnim: ProceduralAnimId;
}

export const GMK87_ALL_19_RGB_MODES: Gmk87RgbModeDefinition[] = [
  {
    id: 1,
    hex: '0x01',
    name: 'Horizontal Wave',
    category: 'Ambient Waves',
    desc: 'Continuous horizontal phase wave sweeping across all 87 south-facing switch LEDs and side underglow.',
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
    desc: 'Soft drifting plasma nebula clouds blending across key zones.',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'jellyfish-glow',
  },
  {
    id: 3,
    hex: '0x03',
    name: 'Spiral Vortex',
    category: 'Ambient Waves',
    desc: 'Radial spiral vortex rotating around the G/H geometric center of the TKL deck.',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'black-hole',
  },
  {
    id: 4,
    hex: '0x04',
    name: 'Dual-Zone Spectrum',
    category: 'Ambient Waves',
    desc: 'Alternating multi-zone cyber gradient shifting smoothly across rows and columns.',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'vaporwave-95',
  },
  {
    id: 5,
    hex: '0x05',
    name: 'Sinusoidal Breathe',
    category: 'Static & Breathing',
    desc: 'Smooth cosine fade-in and fade-out pulse in your calibrated single hue or rainbow cycle.',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'ecg-pulse',
  },
  {
    id: 6,
    hex: '0x06',
    name: 'Calibrated Solid',
    category: 'Static & Breathing',
    desc: 'Locked constant per-key & underglow illumination using exact R/G/B register values (cfg[6..8]).',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: false,
    recommendedLcdAnim: 'cyber-hud',
  },
  {
    id: 7,
    hex: '0x07',
    name: 'Starry Night Canopy',
    category: 'Particle & Matrix',
    desc: 'Stochastic twinkling keycaps shimmering over a deep dark midnight backdrop.',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'lofi-rain',
  },
  {
    id: 8,
    hex: '0x08',
    name: 'Meteor Shower',
    category: 'Particle & Matrix',
    desc: 'High-velocity shooting light trails streaking across key rows with decaying phosphor tails.',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'akira-bike',
  },
  {
    id: 9,
    hex: '0x09',
    name: 'Digital Matrix Rain',
    category: 'Particle & Matrix',
    desc: 'Vertical cascading code droplets falling down the 15 matrix columns.',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'matrix-rain',
  },
  {
    id: 10,
    hex: '0x0A',
    name: 'Keystroke Water Ripple',
    category: 'Reactive Keystroke',
    desc: 'Concentric shockwave ring expanding outward across the 87-key matrix from every key you press.',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'bongo-cat',
  },
  {
    id: 11,
    hex: '0x0B',
    name: 'Reactive Key Trace',
    category: 'Reactive Keystroke',
    desc: 'Ignites individual switches on actuation and smoothly decays back to stealth black.',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'sandevistan-cyber',
  },
  {
    id: 12,
    hex: '0x0C',
    name: 'Laser Crosshair',
    category: 'Reactive Keystroke',
    desc: 'Fires horizontal row and vertical column laser beams intersecting at the actuated switch.',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'gundam-lock',
  },
  {
    id: 13,
    hex: '0x0D',
    name: 'Converging Neon Tide',
    category: 'Ambient Waves',
    desc: 'Symmetrical waves launching from left and right chassis edges and colliding in the center.',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'outrun-911',
  },
  {
    id: 14,
    hex: '0x0E',
    name: 'Knight Rider Scanner',
    category: 'Particle & Matrix',
    desc: 'KITT/Cylon horizontal scanner bar bouncing back and forth with a glowing afterimage.',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'turbo-boost',
  },
  {
    id: 15,
    hex: '0x0F',
    name: 'Radar Pinwheel',
    category: 'Ambient Waves',
    desc: '360-degree rotating colour blades sweeping clockwise or counter-clockwise around the board.',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'sharingan-eye',
  },
  {
    id: 16,
    hex: '0x10',
    name: 'Spectrum Sine Ribbon',
    category: 'Ambient Waves',
    desc: 'Oscillating sinusoidal wave undulating vertically across the 6 physical key rows.',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'neon-spectrum',
  },
  {
    id: 17,
    hex: '0x11',
    name: 'Spring Blossom Splash',
    category: 'Particle & Matrix',
    desc: 'Multi-point blooming radial clusters that organically open and fade across the board.',
    supportsDirection: false,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'kirby-dance',
  },
  {
    id: 18,
    hex: '0x12',
    name: 'Cyber Butterfly Sweep',
    category: 'Ambient Waves',
    desc: 'Mirrored diagonal wing gradients flapping outward from the TKL home row.',
    supportsDirection: true,
    supportsCustomHue: true,
    supportsRainbowToggle: true,
    recommendedLcdAnim: 'nerv-emergency',
  },
  {
    id: 0,
    hex: '0x00',
    name: 'Stealth Off (Battery Saver)',
    category: 'Power Saver',
    desc: 'Disables all 87 south-facing switch LEDs and chassis underglow to maximize 3000mAh wireless runtime.',
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
    brightness: 9,
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
    brightness: 9,
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
    effect: 9, // Matrix Rain
    brightness: 8,
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
    brightness: 9,
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
    subtitle: 'NERV purple butterfly sweep with emergency hex HUD alert',
    effect: 18, // Cyber Butterfly
    brightness: 9,
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
    subtitle: 'Crimson meteor trails across rows paired with Kaneda slide animation',
    effect: 8, // Meteor
    brightness: 9,
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
    brightness: 7,
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
    brightness: 7,
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
    subtitle: 'Soft cherry-blossom pink droplets blooming across key clusters',
    effect: 17, // Spring Blossom
    brightness: 8,
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
    brightness: 8,
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
    subtitle: 'Zero-distraction dark deck that fires cyan laser crosshairs on key press',
    effect: 12, // Crosshair
    brightness: 9,
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
    brightness: 9,
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
    desc: 'Slows down wave, vortex, and particle animation cadence',
    registerNote: 'cfg[3] = max(0, cfg[3]-1)',
    actionType: 'spd-down',
  },
  {
    id: 'fn-right',
    combo: 'Fn + → Right',
    matrixPos: 'L1 [6,13] · 0x5CCB',
    title: 'Effect Speed Faster (+)',
    desc: 'Accelerates wave, vortex, and particle animation cadence',
    registerNote: 'cfg[3] = min(4, cfg[3]+1)',
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

/**
 * Computes the instantaneous [R, G, B, intensity(0..1)] of a physical keycap on the 87-key TKL deck
 * for any of the 19 GMK87 firmware modes (0..18).
 */
export function computePerKeyShader(params: {
  keyX: number; // 0..16.5 physical units
  keyY: number; // 0..6.5 physical units
  row: number;
  col: number;
  effect: number; // 0..18
  brightness: number; // 0..9
  speed: number; // 0..4
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
    return { r: 15, g: 23, b: 42, alpha: 0.08 };
  }

  const briScale = Math.max(0.12, Math.min(1, brightness / 9));
  const spdMul = 0.65 + speed * 0.55;
  const dirSign = direction ? -1 : 1;
  const t = timeSec * spdMul * dirSign;
  const absT = timeSec * spdMul;

  const [baseHue] = rgbToHsv(baseR, baseG, baseB);
  const centerX = 7.5;
  const centerY = 3.2;
  const dx = keyX - centerX;
  const dy = keyY - centerY;
  const distCenter = Math.sqrt(dx * dx + dy * dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const pickColor = (phaseHueOffset: number, intensity = 1): { r: number; g: number; b: number; alpha: number } => {
    const clampedInt = Math.max(0.08, Math.min(1, intensity)) * briScale;
    if (rainbow) {
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
      // Horizontal Wave
      const wavePhase = keyX * 22 - t * 110;
      const pulse = 0.55 + 0.45 * Math.sin((wavePhase * Math.PI) / 180);
      return pickColor(wavePhase, rainbow ? 0.95 : pulse);
    }
    case 2: {
      // Colour Cloud (2D plasma)
      const p1 = Math.sin(keyX * 0.45 + t * 1.8);
      const p2 = Math.cos(keyY * 0.65 - t * 1.4);
      const norm = (p1 + p2 + 2) / 4;
      return pickColor(baseHue + norm * 160 + t * 45, 0.45 + 0.55 * norm);
    }
    case 3: {
      // Spiral Vortex
      const spiral = angleDeg + distCenter * 28 - t * 140;
      const pulse = 0.5 + 0.5 * Math.sin((spiral * Math.PI) / 180);
      return pickColor(spiral, rainbow ? 0.92 : pulse);
    }
    case 4: {
      // Dual-Zone Mix Colour
      const zoneHue = (row * 35 + col * 18 + t * 85) % 360;
      const [rr, gg, bb] = rainbow
        ? hslToRgb(zoneHue, 92, 55)
        : hslToRgb(baseHue + Math.sin(t + col * 0.3) * 45, 90, 55);
      return {
        r: Math.round(rr * briScale),
        g: Math.round(gg * briScale),
        b: Math.round(bb * briScale),
        alpha: briScale,
      };
    }
    case 5: {
      // Sinusoidal Breathe
      const breathe = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(absT * 2.4));
      return pickColor(baseHue + absT * 30, breathe);
    }
    case 6: {
      // Calibrated Solid
      return {
        r: Math.round(baseR * briScale),
        g: Math.round(baseG * briScale),
        b: Math.round(baseB * briScale),
        alpha: briScale,
      };
    }
    case 7: {
      // Starry Night Canopy
      const seed = Math.sin((row * 17 + col * 31 + 1) * 12.9898) * 43758.5453;
      const phase = (seed - Math.floor(seed)) * Math.PI * 2;
      const twinkle = Math.max(0.12, Math.pow(0.5 + 0.5 * Math.sin(absT * 3.1 + phase), 3));
      return pickColor(baseHue + (row * 25 + col * 14), twinkle);
    }
    case 8: {
      // Meteor Shower across rows
      const headX = (((t * 7.5 + row * 3.7) % 20) + 20) % 20 - 2;
      const trailDist = direction ? keyX - headX : headX - keyX;
      const tail = trailDist >= 0 && trailDist < 5.5 ? 1 - trailDist / 5.5 : 0.12;
      return pickColor(baseHue + row * 40 + keyX * 10, tail);
    }
    case 9: {
      // Digital Matrix Rain down columns
      const colSeed = ((col * 7 + 3) % 11) * 0.65;
      const dropY = (((t * 3.8 + colSeed) % 9) + 9) % 9 - 1.5;
      const distY = direction ? keyY - dropY : dropY - keyY;
      const glow = distY >= 0 && distY < 3.2 ? 1 - distY / 3.2 : 0.12;
      return pickColor(rainbow ? col * 24 + t * 50 : 140, glow);
    }
    case 10: {
      // Keystroke Water Ripple (also auto-pulses gently if no recent ripple)
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
      if (maxRipple < 0.05) {
        // Subtle idle heartbeat ripple from center so preview stays alive
        const idleRadius = (absT * 3.2) % 11;
        const idleRing = Math.max(0.12, 0.55 * (1 - Math.min(1, Math.abs(distCenter - idleRadius) / 2.2)));
        return pickColor(baseHue + distCenter * 20, idleRing);
      }
      return pickColor(rippleHue, 0.15 + 0.85 * maxRipple);
    }
    case 11: {
      // Reactive Key Trace
      let maxTrace = 0.12;
      const nowMs = performance.now();
      for (const rp of ripples) {
        if (rp.row === row && rp.col === col) {
          const ageSec = (nowMs - rp.timestamp) / 1000;
          if (ageSec < 1.4) {
            maxTrace = Math.max(maxTrace, 1 - ageSec / 1.4);
          }
        }
      }
      if (ripples.length === 0) {
        // Demo scanning trace when no keys pressed recently
        const demoCol = Math.floor((absT * 4) % 15);
        const demoRow = Math.floor((absT * 1.7) % 6);
        if (col === demoCol || row === demoRow) maxTrace = 0.65;
      }
      return pickColor(baseHue + col * 18, maxTrace);
    }
    case 12: {
      // Laser Crosshair
      let beam = 0.12;
      const nowMs = performance.now();
      for (const rp of ripples) {
        const ageSec = (nowMs - rp.timestamp) / 1000;
        if (ageSec < 1.1 && (rp.row === row || rp.col === col)) {
          beam = Math.max(beam, 1 - ageSec / 1.1);
        }
      }
      if (ripples.length === 0) {
        const activeRow = Math.floor((absT * 1.5) % 6);
        const activeCol = Math.floor((absT * 2.5) % 15);
        if (row === activeRow || col === activeCol) beam = 0.82;
      }
      return pickColor(baseHue + (row + col) * 15, beam);
    }
    case 13: {
      // Converging Neon Tide
      const edgeDist = Math.abs(keyX - centerX);
      const tidePhase = edgeDist * 35 - t * 130;
      const wave = 0.45 + 0.55 * Math.sin((tidePhase * Math.PI) / 180);
      return pickColor(tidePhase + baseHue, wave);
    }
    case 14: {
      // Knight Rider Scanner
      const scanX = 8.2 + Math.sin(absT * 2.2) * 8.0;
      const prox = Math.max(0.12, 1 - Math.abs(keyX - scanX) / 2.8);
      return pickColor(baseHue + keyX * 14, prox);
    }
    case 15: {
      // Radar Pinwheel
      const wheelHue = (angleDeg + 180 + t * 120) % 360;
      const blade = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(((angleDeg * 2 - t * 140) * Math.PI) / 180));
      return pickColor(wheelHue, rainbow ? 0.95 : blade);
    }
    case 16: {
      // Spectrum Sine Ribbon
      const sineY = 3.0 + Math.sin(keyX * 0.55 - t * 2.6) * 2.4;
      const ribbon = Math.max(0.15, 1 - Math.abs(keyY - sineY) / 1.9);
      return pickColor(baseHue + keyX * 22, ribbon);
    }
    case 17: {
      // Spring Blossom Splash
      const b1 = Math.sin(keyX * 0.8 + absT * 2.2) * Math.cos(keyY * 0.9 - absT * 1.9);
      const bloom = 0.25 + 0.75 * Math.abs(b1);
      return pickColor(baseHue + bloom * 140 + col * 12, bloom);
    }
    case 18:
    default: {
      // Cyber Butterfly Sweep
      const wing = Math.abs(dx) * 24 + Math.abs(dy) * 32 - t * 125;
      const flap = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((wing * Math.PI) / 180));
      return pickColor(baseHue + wing, flap);
    }
  }
}
