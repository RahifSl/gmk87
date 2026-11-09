import { LCD_WIDTH, LCD_HEIGHT, toRGB565, fromRGB565 } from '../services/gmk87Hid';

export type ProceduralAnimId =
  // Memes & Pets
  | 'bongo-cat'
  | 'nyan-rainbow'
  | 'dvd-bounce'
  | 'shiba-vibe'
  | 'this-is-fine'
  | 'kirby-dance'
  // Retro Arcade & Gaming
  | 'pacman-chase'
  | 'space-invaders'
  | 'hadouken-clash'
  | 'mario-run'
  | 'tetris-drop'
  | 'doom-hud'
  // Anime, Mecha & Cyberpunk
  | 'nerv-emergency'
  | 'sandevistan-cyber'
  | 'akira-bike'
  | 'sharingan-eye'
  | 'gundam-lock'
  | 'saiyan-aura'
  // JDM Cars & Sim Racing
  | 'ae86-touge'
  | 'f1-telemetry'
  | 'turbo-boost'
  | 'outrun-911'
  // Lo-Fi, Sci-Fi & Cozy Aesthetics
  | 'synthwave-grid'
  | 'pixel-campfire'
  | 'lofi-rain'
  | 'black-hole'
  | 'jellyfish-glow'
  | 'vaporwave-95'
  // Hardware HUDs & Visualizers
  | 'neon-spectrum'
  | 'cyber-hud'
  | 'matrix-rain'
  | 'flip-clock'
  | 'ecg-pulse';

export type GifCategory =
  | 'All'
  | 'Memes & Pets'
  | 'Retro Arcade'
  | 'Anime & Mecha'
  | 'JDM & Racing'
  | 'Lo-Fi & Sci-Fi'
  | 'Hardware HUDs';

export interface CuratedGifPreset {
  id: ProceduralAnimId;
  title: string;
  subtitle: string;
  category: Exclude<GifCategory, 'All'>;
  frames: number;
  badgeColor: string;
}

export const CURATED_GIF_LIBRARY: CuratedGifPreset[] = [
  // Memes & Pets
  {
    id: 'bongo-cat',
    title: '🐱 Bongo Cat Turbo Typing',
    subtitle: 'Animated paws slamming a mini GMK87 with RGB underglow',
    category: 'Memes & Pets',
    frames: 12,
    badgeColor: '#06b6d4',
  },
  {
    id: 'nyan-rainbow',
    title: '🌈 Nyan Cat Pop-Tart Flight',
    subtitle: 'Pixel pop-tart cat soaring across 240×135 space with 6-band rainbow wave',
    category: 'Memes & Pets',
    frames: 12,
    badgeColor: '#ec4899',
  },
  {
    id: 'dvd-bounce',
    title: '💿 DVD Screensaver Corner Hit',
    subtitle: 'Color-cycling DVD logo bouncing across the 240×135 bezel & hitting the corner',
    category: 'Memes & Pets',
    frames: 16,
    badgeColor: '#a855f7',
  },
  {
    id: 'shiba-vibe',
    title: '🐕 Cool Shiba Deal-With-It Vibe',
    subtitle: 'Pixel Shiba Inu bobbing to the beat with neon pixel sunglasses',
    category: 'Memes & Pets',
    frames: 12,
    badgeColor: '#f59e0b',
  },
  {
    id: 'this-is-fine',
    title: '☕ "This Is Fine" Cozy Fire Dog',
    subtitle: 'Iconic meme dog sipping coffee calmly inside a blazing pixel room',
    category: 'Memes & Pets',
    frames: 12,
    badgeColor: '#f97316',
  },
  {
    id: 'kirby-dance',
    title: '⭐ Pink Puffball Victory Dance',
    subtitle: 'Trio of cute pixel puffballs spinning & hopping on a starry stage',
    category: 'Memes & Pets',
    frames: 12,
    badgeColor: '#f472b6',
  },

  // Retro Arcade
  {
    id: 'pacman-chase',
    title: '🍒 Pac-Man Widescreen Maze Chase',
    subtitle: 'Pac-Man chomping power pellets across 240×135 pursued by 4 arcade ghosts',
    category: 'Retro Arcade',
    frames: 14,
    badgeColor: '#facc15',
  },
  {
    id: 'space-invaders',
    title: '👾 Space Invaders 16-Bit Armada',
    subtitle: 'Alien formation marching across the LCD with laser defense bunkers',
    category: 'Retro Arcade',
    frames: 12,
    badgeColor: '#10b981',
  },
  {
    id: 'hadouken-clash',
    title: '🥋 Arcade Fighter Energy Beam Clash',
    subtitle: 'Widescreen plasma beam collision with arcade KO health bars',
    category: 'Retro Arcade',
    frames: 12,
    badgeColor: '#38bdf8',
  },
  {
    id: 'mario-run',
    title: '🍄 8-Bit Kingdom World 1-1 Sprint',
    subtitle: 'Side-scrolling pixel bricks, spinning ? blocks, clouds & jumping hero',
    category: 'Retro Arcade',
    frames: 14,
    badgeColor: '#ef4444',
  },
  {
    id: 'tetris-drop',
    title: '🧱 High-Speed Tetromino Line Clear',
    subtitle: 'Neon blocks locking into place with 4-line TETRIS flash effects',
    category: 'Retro Arcade',
    frames: 14,
    badgeColor: '#a855f7',
  },
  {
    id: 'doom-hud',
    title: '🛡️ Retro Boomer-Shooter Status HUD',
    subtitle: 'Classic armor/health/ammo status bar with animated plasma coil',
    category: 'Retro Arcade',
    frames: 12,
    badgeColor: '#dc2626',
  },

  // Anime & Mecha
  {
    id: 'nerv-emergency',
    title: '⚠️ NERV MAGI Tactical Emergency',
    subtitle: 'Iconic Evangelion crimson/amber hexagonal EMERGENCY alert grid',
    category: 'Anime & Mecha',
    frames: 12,
    badgeColor: '#ef4444',
  },
  {
    id: 'sandevistan-cyber',
    title: '⚡ Edgerunners Sandevistan Speed Trail',
    subtitle: 'Chromatic afterimage silhouettes with neon yellow/cyan neural HUD',
    category: 'Anime & Mecha',
    frames: 14,
    badgeColor: '#fde047',
  },
  {
    id: 'akira-bike',
    title: '🏍️ Neo-Tokyo Kaneda Laser Drift',
    subtitle: 'Iconic side-slide across Neo-Tokyo highway with twin plasma light trails',
    category: 'Anime & Mecha',
    frames: 12,
    badgeColor: '#e11d48',
  },
  {
    id: 'sharingan-eye',
    title: '👁️ Crimson Tomoe Hypnotic Spin',
    subtitle: 'Rotating crimson optical pattern with dark chakra lightning arcs',
    category: 'Anime & Mecha',
    frames: 12,
    badgeColor: '#dc2626',
  },
  {
    id: 'gundam-lock',
    title: '🤖 Mecha RX-78 Optical Target Lock',
    subtitle: 'Mobile Suit cockpit reticle scanning & locking hostile signatures',
    category: 'Anime & Mecha',
    frames: 12,
    badgeColor: '#22d3ee',
  },
  {
    id: 'saiyan-aura',
    title: '🔥 Over-9000 Golden Plasma Aura',
    subtitle: 'Surging golden energy waves, rising rocks & bio-electric sparks',
    category: 'Anime & Mecha',
    frames: 12,
    badgeColor: '#facc15',
  },

  // JDM & Racing
  {
    id: 'ae86-touge',
    title: '🗻 AE86 Trueno Mt. Akina Touge Drift',
    subtitle: 'Pop-up headlights slicing through mountain fog + 9,000 RPM redline tach',
    category: 'JDM & Racing',
    frames: 12,
    badgeColor: '#f8fafc',
  },
  {
    id: 'f1-telemetry',
    title: '🏎️ F1 Steering Wheel RPM & DRS Strip',
    subtitle: '15-LED shift light array, 8th Gear readout, ERS battery & tyre temps',
    category: 'JDM & Racing',
    frames: 14,
    badgeColor: '#10b981',
  },
  {
    id: 'turbo-boost',
    title: '🐌 Twin-Turbo 24 PSI Boost & AFR Gauge',
    subtitle: 'Sweeping JDM digital boost pressure dial with blow-off peak warning',
    category: 'JDM & Racing',
    frames: 12,
    badgeColor: '#06b6d4',
  },
  {
    id: 'outrun-911',
    title: '🌴 Outrun Midnight 911 Turbo Tailbar',
    subtitle: 'Glowing crimson rear lightbar speeding toward a neon synth horizon',
    category: 'JDM & Racing',
    frames: 12,
    badgeColor: '#ec4899',
  },

  // Lo-Fi & Sci-Fi
  {
    id: 'synthwave-grid',
    title: '🌅 80s Synthwave Sunset Grid',
    subtitle: 'Retrowave segmented sun & scrolling perspective horizon',
    category: 'Lo-Fi & Sci-Fi',
    frames: 12,
    badgeColor: '#ec4899',
  },
  {
    id: 'pixel-campfire',
    title: '🔥 Cozy Pixel Campfire',
    subtitle: 'Crackling 16-bit pixel flames, embers & starry night sky',
    category: 'Lo-Fi & Sci-Fi',
    frames: 12,
    badgeColor: '#f59e0b',
  },
  {
    id: 'lofi-rain',
    title: '🌧️ Lo-Fi Midnight Tokyo Rainy Window',
    subtitle: 'Warm city bokeh lights & raindrops streaking down dark glass',
    category: 'Lo-Fi & Sci-Fi',
    frames: 14,
    badgeColor: '#60a5fa',
  },
  {
    id: 'black-hole',
    title: '🕳️ Gargantua Relativistic Black Hole',
    subtitle: 'Gravitational lensing accretion disk glowing in gold & deep amber',
    category: 'Lo-Fi & Sci-Fi',
    frames: 14,
    badgeColor: '#fb923c',
  },
  {
    id: 'jellyfish-glow',
    title: '🪼 Deep-Sea Bioluminescent Jellyfish',
    subtitle: 'Translucent cyan & violet jellyfish pulsing in abyssal waters',
    category: 'Lo-Fi & Sci-Fi',
    frames: 12,
    badgeColor: '#22d3ee',
  },
  {
    id: 'vaporwave-95',
    title: '🗽 Vaporwave 1995 Aesthetic Plaza',
    subtitle: 'Checkerboard floor, palm silhouettes, retro window & cyan sun',
    category: 'Lo-Fi & Sci-Fi',
    frames: 12,
    badgeColor: '#a855f7',
  },

  // Hardware HUDs
  {
    id: 'neon-spectrum',
    title: '🎵 24-Band Neon Audio Spectrum',
    subtitle: 'Bars + peak-hold dots + top oscilloscope waveform',
    category: 'Hardware HUDs',
    frames: 16,
    badgeColor: '#8b5cf6',
  },
  {
    id: 'cyber-hud',
    title: '📊 Cyberpunk Telemetry HUD',
    subtitle: 'Live CPU load, DDR5 RAM bar, GPU temp & Now Playing',
    category: 'Hardware HUDs',
    frames: 10,
    badgeColor: '#06b6d4',
  },
  {
    id: 'matrix-rain',
    title: '💻 Matrix Digital Rain',
    subtitle: 'Cascading katakana & hex glyphs with phosphor trails',
    category: 'Hardware HUDs',
    frames: 14,
    badgeColor: '#10b981',
  },
  {
    id: 'flip-clock',
    title: '🕰️ Minimalist Split-Flap Desk Clock',
    subtitle: 'Ultra-crisp 240×135 mechanical flip-clock cards with seconds',
    category: 'Hardware HUDs',
    frames: 12,
    badgeColor: '#e2e8f0',
  },
  {
    id: 'ecg-pulse',
    title: '💓 Biometric ECG Heartbeat Monitor',
    subtitle: 'Medical phosphor sweep waveform with live BPM & SpO2 readout',
    category: 'Hardware HUDs',
    frames: 14,
    badgeColor: '#10b981',
  },
];

export interface TelemetryHudMetrics {
  cpuPercent: number;
  ramPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  gpuTempC: number;
  uptimeStr: string;
  trackTitle: string;
  trackArtist: string;
  wpm?: number;
}

export interface LcdCustomizationOptions {
  overlayMode: 'default' | 'split-clock' | 'top-tag' | 'clean';
  customTagText: string;
  colorFilter: 'none' | 'crt-scanlines' | 'gameboy' | 'cyber-tint';
  pokemonLayout: 'pokedex-hud' | 'fullscreen-cinema' | 'split-clock-sprite' | 'wanted-bounty';
}

export const DEFAULT_LCD_CUSTOMIZATION: LcdCustomizationOptions = {
  overlayMode: 'default',
  customTagText: 'GMK87 // PRO',
  colorFilter: 'none',
  pokemonLayout: 'pokedex-hud',
};

/**
 * Applies optional Floyd-Steinberg error-diffusion dithering when quantizing 24-bit RGBA to 16-bit RGB565.
 */
export function quantizeImageDataToRGB565Preview(
  src: ImageData,
  useDithering = false
): ImageData {
  const out = new ImageData(src.width, src.height);
  const w = src.width;
  const h = src.height;

  const buf = new Float32Array(src.data.length);
  for (let i = 0; i < src.data.length; i++) {
    buf[i] = src.data[i];
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const oldR = Math.max(0, Math.min(255, Math.round(buf[idx])));
      const oldG = Math.max(0, Math.min(255, Math.round(buf[idx + 1])));
      const oldB = Math.max(0, Math.min(255, Math.round(buf[idx + 2])));

      const rgb565 = toRGB565(oldR, oldG, oldB);
      const [newR, newG, newB] = fromRGB565(rgb565);

      out.data[idx] = newR;
      out.data[idx + 1] = newG;
      out.data[idx + 2] = newB;
      out.data[idx + 3] = 255;

      if (useDithering) {
        const errR = oldR - newR;
        const errG = oldG - newG;
        const errB = oldB - newB;

        const distribute = (dx: number, dy: number, factor: number) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = (ny * w + nx) * 4;
            buf[nIdx] += errR * factor;
            buf[nIdx + 1] += errG * factor;
            buf[nIdx + 2] += errB * factor;
          }
        };

        distribute(1, 0, 7 / 16);
        distribute(-1, 1, 3 / 16);
        distribute(0, 1, 5 / 16);
        distribute(1, 1, 1 / 16);
      }
    }
  }

  return out;
}

/**
 * Post-processes any 240x135 context with the user's custom GMK87 screen overlays & retro filters
 */
export function applyLcdCustomOverlays(
  ctx: CanvasRenderingContext2D,
  custom?: LcdCustomizationOptions
): void {
  if (!custom) return;
  const w = LCD_WIDTH;
  const h = LCD_HEIGHT;

  // 1. Color / CRT Filter
  if (custom.colorFilter === 'crt-scanlines') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (let y = 0; y < h; y += 2) {
      ctx.fillRect(0, y, w, 1);
    }
  } else if (custom.colorFilter === 'gameboy') {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      if (lum > 192) {
        d[i] = 155;
        d[i + 1] = 188;
        d[i + 2] = 15;
      } else if (lum > 128) {
        d[i] = 139;
        d[i + 1] = 172;
        d[i + 2] = 15;
      } else if (lum > 64) {
        d[i] = 48;
        d[i + 1] = 98;
        d[i + 2] = 48;
      } else {
        d[i] = 15;
        d[i + 1] = 56;
        d[i + 2] = 15;
      }
    }
    ctx.putImageData(img, 0, 0);
  } else if (custom.colorFilter === 'cyber-tint') {
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.fillRect(0, 0, w, h);
  }

  // 2. Overlay Modes tailored for the 240x135 Keyboard Screen
  if (custom.overlayMode === 'top-tag' && custom.customTagText.trim()) {
    ctx.fillStyle = 'rgba(7, 11, 20, 0.88)';
    ctx.fillRect(0, 0, w, 18);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(w, 18);
    ctx.stroke();

    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(custom.customTagText.toUpperCase().slice(0, 26), 8, 13);
  } else if (custom.overlayMode === 'split-clock') {
    // Left 86px dedicated live Clock & Status Dock so you get BOTH clock and animated GIF!
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();

    ctx.fillStyle = 'rgba(9, 13, 24, 0.92)';
    ctx.fillRect(0, 0, 86, h);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(86, 0);
    ctx.lineTo(86, h);
    ctx.stroke();

    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText(custom.customTagText.slice(0, 11) || 'GMK87 OS', 6, 15);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillText(hh, 10, 46);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(mm, 10, 72);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(`:${ss}`, 48, 72);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText(dateStr, 10, 96);

    // Battery / Mode bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 108, 64, 14);
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText('USB · 100%', 16, 118);
  }
}

/**
 * Draws a single frame of any built-in procedural animation onto a 240x135 2D context
 */
export function drawProceduralAnimationFrame(
  ctx: CanvasRenderingContext2D,
  animId: ProceduralAnimId,
  frameIndex: number,
  telemetry?: TelemetryHudMetrics,
  audioSpectrum?: number[],
  custom?: LcdCustomizationOptions
): void {
  const w = LCD_WIDTH;
  const h = LCD_HEIGHT;
  ctx.save();

  switch (animId) {
    case 'bongo-cat': {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#090d1a');
      grad.addColorStop(0.65, '#161f38');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.14)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 88);
        ctx.stroke();
      }

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, 78);
      ctx.lineTo(w, 92);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 78);
      ctx.lineTo(w, 92);
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;

      const bob = Math.sin(frameIndex * 0.45) * 2;
      ctx.beginPath();
      ctx.ellipse(120, 66 + bob, 44, 30, 0.06, Math.PI, 0, false);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(82, 50 + bob);
      ctx.lineTo(76, 26 + bob);
      ctx.lineTo(98, 40 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(142, 40 + bob);
      ctx.lineTo(162, 26 + bob);
      ctx.lineTo(158, 52 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f472b6';
      ctx.fillRect(82, 34 + bob, 6, 8);
      ctx.fillRect(150, 34 + bob, 6, 8);

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(103, 56 + bob, 3.2, 0, Math.PI * 2);
      ctx.arc(137, 56 + bob, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fb7185';
      ctx.fillRect(92, 60 + bob, 6, 3);
      ctx.fillRect(142, 60 + bob, 6, 3);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(116, 60 + bob, 4, 0, Math.PI);
      ctx.arc(124, 60 + bob, 4, 0, Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.fillRect(58, 92, 124, 32);
      ctx.strokeRect(58, 92, 124, 32);

      const hue = (frameIndex * 18) % 360;
      ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
      ctx.fillRect(62, 122, 116, 3);

      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(162, 100, 14, 9);

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 10; c++) {
          const isLit = (r + c + frameIndex) % 5 === 0;
          ctx.fillStyle = isLit ? '#22d3ee' : '#334155';
          ctx.fillRect(64 + c * 9.5, 96 + r * 8, 7, 6);
        }
      }

      const leftDown = frameIndex % 2 === 0;
      const rightDown = !leftDown;

      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(86, leftDown ? 98 : 74, 11, 8, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(148, rightDown ? 100 : 75, 11, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const hitX = leftDown ? 86 : 148;
      const hitY = leftDown ? 102 : 104;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      for (let a = 0; a < 6; a++) {
        const angle = (a * Math.PI) / 3 + frameIndex * 0.2;
        ctx.beginPath();
        ctx.moveTo(hitX + Math.cos(angle) * 6, hitY + Math.sin(angle) * 6);
        ctx.lineTo(hitX + Math.cos(angle) * 13, hitY + Math.sin(angle) * 13);
        ctx.stroke();
      }

      if (custom?.overlayMode !== 'clean') {
        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText('GMK87 // BONGO TURBO', 8, 14);
        ctx.fillStyle = '#a855f7';
        ctx.fillText(`${115 + (frameIndex % 14)} WPM`, 182, 14);
      }
      break;
    }

    case 'nyan-rainbow': {
      // Deep space blue backdrop
      ctx.fillStyle = '#071330';
      ctx.fillRect(0, 0, w, h);

      // Scrolling pixel stars
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 16; s++) {
        const sx = (w - ((frameIndex * 14 + s * 31) % w));
        const sy = (s * 23 + 9) % (h - 10);
        ctx.fillRect(sx, sy, s % 3 === 0 ? 4 : 2, s % 3 === 0 ? 4 : 2);
      }

      // 6-Band Rainbow Wave
      const rainbowColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
      for (let seg = 0; seg < 14; seg++) {
        const sx = seg * 10;
        const waveY = Math.sin((seg + frameIndex) * 0.8) * 5;
        rainbowColors.forEach((col, cIdx) => {
          ctx.fillStyle = col;
          ctx.fillRect(sx, 42 + waveY + cIdx * 8, 11, 8);
        });
      }

      const catY = 38 + Math.sin(frameIndex * 0.6) * 4;
      // Pop-Tart body
      ctx.fillStyle = '#fcd34d';
      ctx.fillRect(116, catY, 56, 44);
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(120, catY + 4, 48, 36);
      // Sprinkles
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(126, catY + 10, 4, 4);
      ctx.fillRect(142, catY + 14, 4, 4);
      ctx.fillRect(132, catY + 28, 4, 4);
      ctx.fillRect(154, catY + 24, 4, 4);

      // Cat Head & Ears
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(156, catY + 10, 32, 26);
      ctx.fillRect(158, catY + 2, 8, 8);
      ctx.fillRect(178, catY + 2, 8, 8);

      // Eyes & Blush
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(164, catY + 18, 4, 4);
      ctx.fillRect(178, catY + 18, 4, 4);
      ctx.fillStyle = '#fb7185';
      ctx.fillRect(160, catY + 24, 5, 4);
      ctx.fillRect(181, catY + 24, 5, 4);
      break;
    }

    case 'dvd-bounce': {
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, w, h);

      // Deterministic bounce trajectory that hits corners!
      const cycle = frameIndex % 16;
      const palette = ['#06b6d4', '#ec4899', '#10b981', '#facc15', '#8b5cf6', '#f97316'];
      const color = palette[Math.floor(frameIndex / 2) % palette.length];

      const bx = Math.abs(((frameIndex * 19) % 340) - 170);
      const by = Math.abs(((frameIndex * 13) % 180) - 90);

      // Corner hit celebration flash
      if (cycle === 0 || cycle === 8) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
      }

      ctx.fillStyle = color;
      ctx.font = 'italic bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('DVD', bx + 8, by + 24);
      ctx.beginPath();
      ctx.ellipse(bx + 34, by + 33, 30, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#05070e';
      ctx.font = 'bold 7px "JetBrains Mono", monospace';
      ctx.fillText('VIDEO', bx + 22, by + 35);
      break;
    }

    case 'shiba-vibe': {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Neon synth background bars
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = (i + frameIndex) % 2 === 0 ? '#1e1b4b' : '#090d1a';
        ctx.fillRect(0, i * 17, w, 17);
      }

      const nod = Math.round(Math.sin(frameIndex * 0.7) * 5);
      // Shiba Head
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(120, 74 + nod, 38, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.beginPath();
      ctx.moveTo(86, 52 + nod);
      ctx.lineTo(80, 20 + nod);
      ctx.lineTo(106, 40 + nod);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(154, 52 + nod);
      ctx.lineTo(160, 20 + nod);
      ctx.lineTo(134, 40 + nod);
      ctx.fill();

      // White cheeks/snout
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(120, 86 + nod, 28, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pixel "Deal With It" Sunglasses
      ctx.fillStyle = '#020617';
      ctx.fillRect(88, 56 + nod, 28, 14);
      ctx.fillRect(124, 56 + nod, 28, 14);
      ctx.fillRect(116, 58 + nod, 8, 4);
      // Cyan lens glint
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(92, 59 + nod, 6, 3);
      ctx.fillRect(128, 59 + nod, 6, 3);

      // Nose & Smirk
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(116, 76 + nod, 8, 6);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(110, 90 + nod);
      ctx.lineTo(126, 90 + nod);
      ctx.lineTo(134, 85 + nod);
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('MUCH CLACK // VERY THOCK', 44, 126);
      break;
    }

    case 'this-is-fine': {
      // Blazing orange/red room
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 0, w, h);

      // Background flames
      for (let x = 0; x < w; x += 12) {
        const fh = 32 + Math.sin(frameIndex * 0.8 + x) * 16;
        ctx.fillStyle = '#f97316';
        ctx.fillRect(x, h - fh, 10, fh);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x + 2, h - fh + 12, 6, fh - 12);
      }

      // Table
      ctx.fillStyle = '#78350f';
      ctx.fillRect(40, 96, 160, 39);

      // Calm Dog with bowler hat & coffee mug
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(105, 72, 22, 0, Math.PI * 2);
      ctx.fill();
      // Hat
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(92, 44, 26, 8);
      ctx.fillRect(96, 36, 18, 10);
      // Big calm eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(98, 68, 5, 0, Math.PI * 2);
      ctx.arc(114, 68, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(97, 67, 3, 3);
      ctx.fillRect(113, 67, 3, 3);

      // White Coffee Mug
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(140, 78, 16, 18);

      // Speech Bubble
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(122, 16, 104, 26);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('THIS IS FINE.', 130, 33);
      break;
    }

    case 'kirby-dance': {
      ctx.fillStyle = '#0f0728';
      ctx.fillRect(0, 0, w, h);

      // Stage floor
      ctx.fillStyle = '#311068';
      ctx.fillRect(0, 98, w, 37);

      const positions = [56, 120, 184];
      positions.forEach((px, idx) => {
        const bounce = Math.abs(Math.sin(frameIndex * 0.6 + idx * 0.5)) * 18;
        const py = 76 - bounce;

        // Feet
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.ellipse(px - 10, py + 18, 9, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(px + 10, py + 18, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pink round body
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(px, py, 20, 0, Math.PI * 2);
        ctx.fill();

        // Raised waving arms
        const armY = py - 6 + Math.sin(frameIndex + idx) * 8;
        ctx.beginPath();
        ctx.arc(px - 20, armY, 6, 0, Math.PI * 2);
        ctx.arc(px + 20, armY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Cute eyes & blush
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px - 6, py - 8, 3, 9);
        ctx.fillRect(px + 4, py - 8, 3, 9);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(px - 13, py + 1, 5, 3);
        ctx.fillRect(px + 8, py + 1, 5, 3);
      });
      break;
    }

    case 'pacman-chase': {
      ctx.fillStyle = '#02040a';
      ctx.fillRect(0, 0, w, h);

      // Neon Blue Arcade Maze Walls
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.strokeRect(6, 22, w - 12, 88);
      ctx.strokeRect(12, 28, w - 24, 76);

      // Power Pellets
      for (let x = 24; x < w - 24; x += 18) {
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(x, 66, x % 72 === 0 ? 5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pac-Man chomping across
      const pacX = 36 + ((frameIndex * 14) % 168);
      const mouthAngle = (frameIndex % 2 === 0 ? 0.25 : 0.05) * Math.PI;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(pacX, 66, 15, mouthAngle, Math.PI * 2 - mouthAngle);
      ctx.lineTo(pacX, 66);
      ctx.closePath();
      ctx.fill();

      // Ghosts chasing behind
      const ghosts = [
        { color: '#ef4444', offset: -36 },
        { color: '#f472b6', offset: -68 },
        { color: '#06b6d4', offset: -100 },
      ];
      ghosts.forEach((g) => {
        const gx = ((pacX + g.offset + 200) % 180) + 24;
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(gx, 62, 12, Math.PI, 0, false);
        ctx.lineTo(gx + 12, 78);
        ctx.lineTo(gx - 12, 78);
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gx - 4, 61, 3.5, 0, Math.PI * 2);
        ctx.arc(gx + 4, 61, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.arc(gx - 2, 61, 1.8, 0, Math.PI * 2);
        ctx.arc(gx + 6, 61, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('1UP  HIGH SCORE 99420', 12, 15);
      break;
    }

    case 'space-invaders': {
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      const shiftX = Math.sin(frameIndex * 0.5) * 16;
      const rowColors = ['#f43f5e', '#a855f7', '#06b6d4', '#10b981'];

      for (let r = 0; r < 4; r++) {
        ctx.fillStyle = rowColors[r];
        for (let c = 0; c < 7; c++) {
          const ix = 28 + c * 28 + shiftX;
          const iy = 22 + r * 18;
          // Pixel invader body
          ctx.fillRect(ix + 4, iy, 10, 3);
          ctx.fillRect(ix + 2, iy + 3, 14, 6);
          ctx.fillRect(ix, iy + 9, 18, 3);
          // Animated legs
          if (frameIndex % 2 === 0) {
            ctx.fillRect(ix, iy + 12, 3, 3);
            ctx.fillRect(ix + 15, iy + 12, 3, 3);
          } else {
            ctx.fillRect(ix + 4, iy + 12, 3, 3);
            ctx.fillRect(ix + 11, iy + 12, 3, 3);
          }
        }
      }

      // Player laser cannon at bottom
      const shipX = 110 + Math.cos(frameIndex * 0.4) * 50;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(shipX - 10, 118, 20, 8);
      ctx.fillRect(shipX - 3, 112, 6, 6);

      // Laser bolt
      const laserY = 110 - ((frameIndex * 18) % 90);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(shipX - 1, laserY, 3, 10);
      break;
    }

    case 'hadouken-clash': {
      ctx.fillStyle = '#090d1a';
      ctx.fillRect(0, 0, w, h);

      // Top KO Health Bars
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(10, 10, 92, 10);
      ctx.fillRect(138, 10, 92, 10);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(10, 10, 78, 10);
      ctx.fillRect(152, 10, 78, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('KO', 112, 19);

      // Energy clash center point oscillating
      const clashX = 120 + Math.sin(frameIndex * 0.9) * 18;

      // Left Blue Hadouken Beam
      const leftBeam = ctx.createLinearGradient(0, 76, clashX, 76);
      leftBeam.addColorStop(0, '#1d4ed8');
      leftBeam.addColorStop(1, '#38bdf8');
      ctx.fillStyle = leftBeam;
      ctx.fillRect(20, 64, clashX - 20, 24);

      // Right Crimson Beam
      const rightBeam = ctx.createLinearGradient(clashX, 76, w, 76);
      rightBeam.addColorStop(0, '#f43f5e');
      rightBeam.addColorStop(1, '#9f1239');
      ctx.fillStyle = rightBeam;
      ctx.fillRect(clashX, 64, w - 20 - clashX, 24);

      // Clash Sphere
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(clashX, 76, 20 + (frameIndex % 3) * 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'mario-run': {
      // Classic Sky Blue
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 0, w, h);

      // Ground Bricks
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 108, w, 27);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 104, w, 5);

      // Scrolling Question Blocks & Pipes
      const scroll = (frameIndex * 12) % 240;
      for (let b = 0; b < 4; b++) {
        const bx = (b * 68 - scroll + 240) % 240;
        ctx.fillStyle = '#facc15';
        ctx.fillRect(bx, 52, 20, 20);
        ctx.strokeStyle = '#78350f';
        ctx.strokeRect(bx, 52, 20, 20);
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        ctx.fillText('?', bx + 6, 67);
      }

      // Jumping Pixel Hero
      const jumpY = Math.abs(Math.sin(frameIndex * 0.55)) * 32;
      const hy = 84 - jumpY;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(64, hy, 16, 10); // Cap & Shirt
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(64, hy + 10, 16, 10); // Overalls
      break;
    }

    case 'tetris-drop': {
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, w, h);

      const colors = ['#06b6d4', '#facc15', '#a855f7', '#22c55e', '#ef4444', '#3b82f6'];
      // Bottom stacked matrix
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 18; c++) {
          if ((r + c) % 3 !== 0) {
            ctx.fillStyle = colors[(r * 3 + c) % colors.length];
            ctx.fillRect(12 + c * 12, h - 14 - r * 12, 11, 11);
          }
        }
      }

      // Falling T-Piece
      const dropY = (frameIndex * 8) % 64;
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(108, dropY + 12, 35, 11);
      ctx.fillRect(120, dropY, 11, 11);
      break;
    }

    case 'doom-hud': {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, w, h);

      // Lava ceiling / cyber corridor
      const recoil = (frameIndex % 2) * 3;
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 0, w, 86);

      // Plasma rifle barrel center
      ctx.fillStyle = '#475569';
      ctx.fillRect(98, 52 + recoil, 44, 36);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(120, 46 + recoil, 12 + (frameIndex % 3) * 4, 0, Math.PI * 2);
      ctx.fill();

      // Classic Bottom Status Bar
      ctx.fillStyle = '#292524';
      ctx.fillRect(0, 88, w, 47);
      ctx.strokeStyle = '#78716c';
      ctx.strokeRect(2, 90, w - 4, 43);

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText('200%', 12, 114);
      ctx.fillText('100%', 174, 114);

      ctx.fillStyle = '#a8a29e';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillText('AMMO / CELLS', 10, 128);
      ctx.fillText('ARMOR', 180, 128);

      // Center Marine Visor Badge
      ctx.fillStyle = '#facc15';
      ctx.fillRect(102, 94, 36, 34);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(108, 102, 8, 6);
      ctx.fillRect(124, 102, 8, 6);
      break;
    }

    case 'nerv-emergency': {
      ctx.fillStyle = '#090204';
      ctx.fillRect(0, 0, w, h);

      const flash = frameIndex % 2 === 0;
      // Diagonal Hazard Stripes Top & Bottom
      ctx.fillStyle = flash ? '#ef4444' : '#f59e0b';
      for (let x = -20; x < w + 20; x += 24) {
        const offset = (frameIndex * 6) % 24;
        ctx.beginPath();
        ctx.moveTo(x + offset, 0);
        ctx.lineTo(x + 12 + offset, 0);
        ctx.lineTo(x + offset, 22);
        ctx.lineTo(x - 12 + offset, 22);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x - offset, h - 22);
        ctx.lineTo(x + 12 - offset, h - 22);
        ctx.lineTo(x - offset, h);
        ctx.lineTo(x - 12 - offset, h);
        ctx.fill();
      }

      // Center Hexagonal EMERGENCY Box
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 34, w - 36, 66);

      ctx.fillStyle = flash ? '#ef4444' : '#fb923c';
      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.fillText('EMERGENCY', 48, 72);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('MAGI SYSTEM // CODE: 666', 46, 90);
      break;
    }

    case 'sandevistan-cyber': {
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, w, h);

      // Chromatic Aberration Afterimage Silhouettes
      const trailColors = [
        '#3b82f6',
        '#06b6d4',
        '#10b981',
        '#eab308',
        '#f97316',
        '#ef4444',
        '#fde047',
      ];
      trailColors.forEach((col, idx) => {
        const tx = 28 + idx * 24 + ((frameIndex * 6) % 18);
        const ty = 68 + Math.sin(idx * 0.6 + frameIndex * 0.4) * 10;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(tx, ty - 28, 22, 56);
      });

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('SANDEVISTAN // APF ACTIVE', 12, 18);
      break;
    }

    case 'akira-bike': {
      ctx.fillStyle = '#090410';
      ctx.fillRect(0, 0, w, h);

      // Sweeping Twin Crimson Plasma Tail Trails
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(20, 96);
      ctx.quadraticCurveTo(110, 20 + Math.sin(frameIndex * 0.5) * 18, 220, 44);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(24, 102);
      ctx.quadraticCurveTo(120, 32, 220, 50);
      ctx.stroke();

      // Red Bike Silhouette at front left
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(22, 82, 46, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('NEO-TOKYO // 2026', 12, 18);
      break;
    }

    case 'sharingan-eye': {
      ctx.fillStyle = '#090204';
      ctx.fillRect(0, 0, w, h);

      const cx = 120;
      const cy = 68;
      // Outer Crimson Iris
      const rad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 52);
      rad.addColorStop(0, '#000000');
      rad.addColorStop(0.25, '#991b1b');
      rad.addColorStop(0.85, '#ef4444');
      rad.addColorStop(1, '#000000');
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(cx, cy, 52, 0, Math.PI * 2);
      ctx.fill();

      // Inner ring & 3 rotating Tomoe
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.stroke();

      for (let t = 0; t < 3; t++) {
        const ang = frameIndex * 0.28 + (t * Math.PI * 2) / 3;
        const tx = cx + Math.cos(ang) * 30;
        const ty = cy + Math.sin(ang) * 30;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(tx, ty, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'gundam-lock': {
      ctx.fillStyle = '#040d14';
      ctx.fillRect(0, 0, w, h);

      const cx = 120;
      const cy = 68;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating radar sweep
      const sweep = frameIndex * 0.35;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * 46, cy + Math.sin(sweep) * 46);
      ctx.stroke();

      // Target Lock Reticle Box
      ctx.strokeStyle = '#ef4444';
      ctx.strokeRect(cx - 18, cy - 18, 36, 36);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('LOCK ON // RX-78-2', 10, 16);
      break;
    }

    case 'saiyan-aura': {
      ctx.fillStyle = '#0c0a04';
      ctx.fillRect(0, 0, w, h);

      // Rising Golden Aura Waves
      for (let i = 4; i >= 1; i--) {
        ctx.fillStyle = i === 1 ? '#fef08a' : i === 2 ? '#facc15' : '#ca8a04';
        ctx.beginPath();
        ctx.ellipse(
          120,
          96,
          18 * i + Math.sin(frameIndex + i) * 6,
          28 * i,
          0,
          Math.PI,
          0,
          false
        );
        ctx.fill();
      }

      // Bio-electric cyan sparks
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(85, 40 + (frameIndex % 3) * 10);
      ctx.lineTo(110, 56);
      ctx.lineTo(150, 38);
      ctx.stroke();
      break;
    }

    case 'ae86-touge': {
      ctx.fillStyle = '#080c17';
      ctx.fillRect(0, 0, w, h);

      // Touge Road Lines
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(120, 56);
      ctx.lineTo(20, h);
      ctx.moveTo(120, 56);
      ctx.lineTo(220, h);
      ctx.stroke();

      // Panda AE86 Front Grille & Pop-Up Headlights
      const driftX = 120 + Math.sin(frameIndex * 0.5) * 14;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(driftX - 42, 68, 84, 28);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(driftX - 42, 84, 84, 14);

      // Glowing Yellow Fog & Pop-up Headlights
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(driftX - 38, 60, 18, 10);
      ctx.fillRect(driftX + 20, 60, 18, 10);

      // 9000 RPM Tachometer Bar on Top
      ctx.fillStyle = '#10b981';
      ctx.fillRect(12, 10, 150, 8);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(162, 10, 56, 8);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('FUJIWARA // 8,800 RPM', 12, 30);
      break;
    }

    case 'f1-telemetry': {
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, w, h);

      // 15-LED Shift Light Strip across Top
      const activeLeds = 8 + (frameIndex % 8);
      for (let l = 0; l < 15; l++) {
        const col = l < 5 ? '#22c55e' : l < 10 ? '#ef4444' : '#3b82f6';
        ctx.fillStyle = l < activeLeds ? col : '#1e293b';
        ctx.fillRect(12 + l * 14.5, 10, 11, 10);
      }

      // Center Giant Gear Number
      const gear = 5 + (frameIndex % 4);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 54px "JetBrains Mono", monospace';
      ctx.fillText(`${gear}`, 102, 86);

      // Left Speed & Right DRS Badge
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText(`${292 + gear * 6}`, 14, 68);
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('KM/H', 14, 82);

      ctx.fillStyle = '#10b981';
      ctx.fillRect(164, 52, 62, 24);
      ctx.fillStyle = '#020617';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText('DRS ON', 173, 68);

      // Bottom ERS Battery Strip
      ctx.fillStyle = '#facc15';
      ctx.fillRect(12, 112, 216, 10);
      break;
    }

    case 'turbo-boost': {
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, w, h);

      const cx = 120;
      const cy = 88;
      // Gauge Arc
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, 58, Math.PI, 0, false);
      ctx.stroke();

      const psi = 14 + Math.sin(frameIndex * 0.5) * 9.5;
      const endAngle = Math.PI + (psi / 26) * Math.PI;
      ctx.strokeStyle = psi > 20 ? '#ef4444' : '#06b6d4';
      ctx.beginPath();
      ctx.arc(cx, cy, 58, Math.PI, endAngle, false);
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 26px "JetBrains Mono", monospace';
      ctx.fillText(`${psi.toFixed(1)}`, 86, 84);
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('BAR / PSI BOOST', 76, 104);
      break;
    }

    case 'outrun-911': {
      ctx.fillStyle = '#0d041a';
      ctx.fillRect(0, 0, w, h);

      // Neon Magenta Horizon
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(0, 68, w, 3);

      // Rear Porsche 911 Lightbar Silhouette
      ctx.fillStyle = '#09090b';
      ctx.fillRect(62, 74, 116, 36);
      // Glowing Crimson Tail Light Strip
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(68, 86, 104, 7);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(72, 87, 12, 5);
      ctx.fillRect(156, 87, 12, 5);
      break;
    }

    case 'lofi-rain': {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#090d1e');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Warm Blurred City Bokeh Circles
      const bokeh = [
        { x: 45, y: 78, r: 16, c: 'rgba(251, 146, 60, 0.35)' },
        { x: 95, y: 64, r: 22, c: 'rgba(236, 72, 153, 0.3)' },
        { x: 165, y: 72, r: 18, c: 'rgba(6, 182, 212, 0.35)' },
        { x: 200, y: 84, r: 14, c: 'rgba(250, 204, 21, 0.3)' },
      ];
      bokeh.forEach((b) => {
        ctx.fillStyle = b.c;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Diagonal Rain Streaks
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
      ctx.lineWidth = 1.5;
      for (let r = 0; r < 24; r++) {
        const rx = (r * 23 + frameIndex * 9) % w;
        const ry = (r * 19 + frameIndex * 16) % h;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 5, ry + 14);
        ctx.stroke();
      }
      break;
    }

    case 'black-hole': {
      ctx.fillStyle = '#030308';
      ctx.fillRect(0, 0, w, h);

      const cx = 120;
      const cy = 68;
      // Relativistic Lensing Halo
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.stroke();

      // Horizontal Glowing Accretion Disk
      const disk = ctx.createLinearGradient(20, cy, 220, cy);
      disk.addColorStop(0, '#ea580c');
      disk.addColorStop(0.5, '#fef08a');
      disk.addColorStop(1, '#ea580c');
      ctx.strokeStyle = disk;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 82, 12, Math.sin(frameIndex * 0.2) * 0.08, 0, Math.PI * 2);
      ctx.stroke();

      // Event Horizon Core
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'jellyfish-glow': {
      ctx.fillStyle = '#020817';
      ctx.fillRect(0, 0, w, h);

      const jellies = [
        { x: 75, y: 65, col: '#06b6d4', phase: 0 },
        { x: 165, y: 55, col: '#ec4899', phase: 2 },
      ];

      jellies.forEach((j) => {
        const floatY = j.y + Math.sin(frameIndex * 0.45 + j.phase) * 10;
        ctx.fillStyle = j.col;
        ctx.beginPath();
        ctx.arc(j.x, floatY, 22, Math.PI, 0, false);
        ctx.fill();

        // Tentacles
        ctx.strokeStyle = j.col;
        ctx.lineWidth = 1.5;
        for (let t = -14; t <= 14; t += 7) {
          ctx.beginPath();
          ctx.moveTo(j.x + t, floatY);
          ctx.quadraticCurveTo(
            j.x + t + Math.sin(frameIndex * 0.6 + t) * 8,
            floatY + 22,
            j.x + t,
            floatY + 42
          );
          ctx.stroke();
        }
      });
      break;
    }

    case 'vaporwave-95': {
      ctx.fillStyle = '#008080'; // Classic Win95 Teal
      ctx.fillRect(0, 0, w, h);

      // Checkerboard Floor
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 12; c++) {
          ctx.fillStyle = (r + c + frameIndex) % 2 === 0 ? '#a855f7' : '#0f172a';
          ctx.fillRect(c * 20, 86 + r * 13, 20, 13);
        }
      }

      // Retro Dialog Window
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(42, 16, 156, 62);
      ctx.fillStyle = '#000080';
      ctx.fillRect(45, 19, 150, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('AESTHETIC_95.EXE', 50, 29);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText('V A P O R W A V E', 56, 56);
      break;
    }

    case 'flip-clock': {
      ctx.fillStyle = '#090b10';
      ctx.fillRect(0, 0, w, h);

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');

      // Left Hour Card & Right Minute Card
      [
        { x: 18, val: hh, label: 'HOURS' },
        { x: 126, val: mm, label: 'MINUTES' },
      ].forEach((card) => {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(card.x, 18, 96, 98);
        ctx.strokeStyle = '#27272a';
        ctx.strokeRect(card.x, 18, 96, 98);

        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 54px "JetBrains Mono", monospace';
        ctx.fillText(card.val, card.x + 15, 84);

        // Horizontal Split-Flap Hinge Line
        ctx.fillStyle = '#090b10';
        ctx.fillRect(card.x, 66, 96, 3);
      });
      break;
    }

    case 'ecg-pulse': {
      ctx.fillStyle = '#020b06';
      ctx.fillRect(0, 0, w, h);

      // Medical Grid
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // ECG QRS Complex Waveform
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const sweepX = (frameIndex * 18) % w;
      for (let x = 0; x < w; x += 2) {
        const dist = (x - sweepX + w) % w;
        let y = 76;
        if (dist > 20 && dist < 26) y = 66;
        else if (dist >= 26 && dist < 30) y = 88;
        else if (dist >= 30 && dist < 36) y = 26;
        else if (dist >= 36 && dist < 42) y = 104;
        else if (dist >= 42 && dist < 52) y = 62;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText('♥ 72 BPM', 152, 24);
      break;
    }

    case 'neon-spectrum': {
      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(139, 92, 246, 0.12)';
      for (let y = 20; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const bands = 24;
      const barWidth = 7;
      const gap = 2.5;
      const startX = 8;
      const baseY = 122;

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < w; x += 3) {
        const wave =
          Math.sin(x * 0.08 + frameIndex * 0.45) * 8 +
          Math.cos(x * 0.03 - frameIndex * 0.3) * 5;
        const py = 22 + wave;
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();

      for (let i = 0; i < bands; i++) {
        let val = 0;
        if (audioSpectrum && audioSpectrum[i] !== undefined) {
          val = audioSpectrum[i];
        } else {
          const n1 = Math.sin(i * 0.45 + frameIndex * 0.35) * 0.5 + 0.5;
          const n2 = Math.cos(i * 0.25 - frameIndex * 0.5) * 0.5 + 0.5;
          val = Math.min(1, (n1 * 0.65 + n2 * 0.35) * (1 - Math.abs(i - 11) * 0.025));
        }

        const barH = Math.max(6, Math.round(val * 78));
        const bx = startX + i * (barWidth + gap);
        const by = baseY - barH;

        const barGrad = ctx.createLinearGradient(0, baseY, 0, baseY - 80);
        barGrad.addColorStop(0, '#06b6d4');
        barGrad.addColorStop(0.55, '#8b5cf6');
        barGrad.addColorStop(1, '#f43f5e');

        ctx.fillStyle = barGrad;
        ctx.fillRect(bx, by, barWidth, barH);

        const peakOffset = 4 + Math.round((Math.sin(frameIndex * 0.2 + i) + 1) * 3);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(bx, Math.max(34, by - peakOffset), barWidth, 2.5);
      }

      if (custom?.overlayMode !== 'clean') {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText('24-BAND DSP // RGB565', 8, 12);
        ctx.fillStyle = '#10b981';
        ctx.fillText('-1.4 dBFS', 182, 12);
      }
      break;
    }

    case 'cyber-hud': {
      const m: TelemetryHudMetrics = telemetry || {
        cpuPercent: 34 + ((frameIndex * 3) % 28),
        ramPercent: 62,
        ramUsedGb: 19.8,
        ramTotalGb: 32,
        gpuTempC: 58 + (frameIndex % 5),
        uptimeStr: '04:42:19',
        trackTitle: 'Nightcall (Synth Mix)',
        trackArtist: 'Kavinsky // GMK87',
        wpm: 94,
      };

      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(3, 3, w - 6, h - 6);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(5, 5, w - 10, 18);
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('ZUOYA GMK87 // TELEMETRY', 10, 17);
      ctx.fillStyle = '#10b981';
      ctx.fillText(m.uptimeStr, 180, 17);

      ctx.fillStyle = '#131b2e';
      ctx.fillRect(8, 28, 108, 44);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(8, 28, 108, 44);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('CPU LOAD', 14, 40);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText(`${m.cpuPercent}%`, 14, 58);

      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(14, 63, 96, 5);
      ctx.fillStyle = m.cpuPercent > 80 ? '#f43f5e' : '#06b6d4';
      ctx.fillRect(14, 63, Math.round((m.cpuPercent / 100) * 96), 5);

      ctx.fillStyle = '#131b2e';
      ctx.fillRect(124, 28, 108, 44);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(124, 28, 108, 44);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('DDR5 RAM', 130, 40);
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillText(`${m.ramPercent}%`, 130, 58);
      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${m.ramUsedGb}G`, 192, 57);

      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(130, 63, 96, 5);
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(130, 63, Math.round((m.ramPercent / 100) * 96), 5);

      ctx.fillStyle = '#131b2e';
      ctx.fillRect(8, 78, 224, 48);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(8, 78, 224, 48);

      for (let b = 0; b < 4; b++) {
        const bh = 6 + ((frameIndex * 5 + b * 7) % 16);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(15 + b * 5, 104 - bh, 3.5, bh);
      }

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(m.trackTitle.slice(0, 22), 40, 95);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(m.trackArtist.slice(0, 25), 40, 108);

      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(14, 116, 150, 4);
      const prog = ((frameIndex * 6) % 100) / 100;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(14, 116, Math.round(prog * 150), 4);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`${m.gpuTempC}°C`, 196, 119);
      break;
    }

    case 'matrix-rain': {
      ctx.fillStyle = '#020804';
      ctx.fillRect(0, 0, w, h);

      const cols = 24;
      const chars = '0123456789ABCDEFZGMK87ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';

      for (let c = 0; c < cols; c++) {
        const speed = 1 + (c % 3);
        const headY = ((frameIndex * speed * 9 + c * 37) % (h + 50)) - 20;
        const x = c * 10 + 2;

        for (let tail = 0; tail < 9; tail++) {
          const y = headY - tail * 11;
          if (y < 0 || y > h + 8) continue;
          const charIdx = (c * 13 + tail * 7 + frameIndex) % chars.length;
          if (tail === 0) {
            ctx.fillStyle = '#ecfdf5';
          } else if (tail < 3) {
            ctx.fillStyle = '#10b981';
          } else {
            ctx.fillStyle = `rgba(16, 185, 129, ${Math.max(0.15, 1 - tail * 0.12)})`;
          }
          ctx.fillText(chars[charIdx], x, y);
        }
      }

      if (custom?.overlayMode !== 'clean') {
        ctx.fillStyle = 'rgba(2, 12, 6, 0.86)';
        ctx.fillRect(58, 52, 124, 30);
        ctx.strokeStyle = '#10b981';
        ctx.strokeRect(58, 52, 124, 30);
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText('GMK87 // MATRIX', 70, 71);
      }
      break;
    }

    case 'synthwave-grid': {
      const sky = ctx.createLinearGradient(0, 0, 0, 78);
      sky.addColorStop(0, '#090418');
      sky.addColorStop(0.5, '#2e1065');
      sky.addColorStop(1, '#be185d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, 78);

      const sunGrad = ctx.createLinearGradient(0, 16, 0, 74);
      sunGrad.addColorStop(0, '#fde047');
      sunGrad.addColorStop(0.5, '#f97316');
      sunGrad.addColorStop(1, '#ec4899');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(120, 48, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#2e1065';
      for (let s = 0; s < 5; s++) {
        const sy = 44 + s * 6;
        ctx.fillRect(88, sy, 64, 1.5 + s * 0.5);
      }

      ctx.fillStyle = '#0f0728';
      ctx.beginPath();
      ctx.moveTo(0, 78);
      ctx.lineTo(35, 54);
      ctx.lineTo(75, 74);
      ctx.lineTo(120, 62);
      ctx.lineTo(168, 74);
      ctx.lineTo(205, 50);
      ctx.lineTo(240, 78);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0b041a';
      ctx.fillRect(0, 78, w, h - 78);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(120 + i * 8, 78);
        ctx.lineTo(120 + i * 32, h);
        ctx.stroke();
      }

      const phase = (frameIndex % 8) / 8;
      ctx.strokeStyle = '#ec4899';
      for (let r = 0; r < 6; r++) {
        const norm = (r + phase) / 6;
        const y = 78 + Math.pow(norm, 1.7) * (h - 78);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      break;
    }

    case 'pixel-campfire': {
      ctx.fillStyle = '#080c17';
      ctx.fillRect(0, 0, w, h);

      for (let s = 0; s < 18; s++) {
        const sx = (s * 37 + 11) % (w - 8);
        const sy = (s * 19 + 7) % 68;
        const bright = (s + frameIndex) % 4 === 0;
        ctx.fillStyle = bright ? '#fde047' : '#64748b';
        ctx.fillRect(sx, sy, 2, 2);
      }

      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 102, w, 33);

      ctx.fillStyle = '#78350f';
      ctx.fillRect(82, 102, 76, 10);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(92, 98, 56, 8);

      const P = 4;
      for (let fx = -7; fx <= 7; fx++) {
        const dist = Math.abs(fx);
        const maxFlameH = Math.max(2, 12 - dist * 1.4 + Math.sin(frameIndex * 0.8 + fx) * 2.5);
        for (let fy = 0; fy < maxFlameH; fy++) {
          const px = 120 + fx * P;
          const py = 96 - fy * P;
          if (fy < 3 && dist < 3) {
            ctx.fillStyle = '#fef08a';
          } else if (fy < 6) {
            ctx.fillStyle = '#facc15';
          } else if (fy < 9) {
            ctx.fillStyle = '#f97316';
          } else {
            ctx.fillStyle = '#ef4444';
          }
          ctx.fillRect(px, py, P, P);
        }
      }

      for (let e = 0; e < 6; e++) {
        const ex = 104 + ((e * 17 + frameIndex * 3) % 34);
        const ey = 54 - ((frameIndex * 4 + e * 13) % 42);
        ctx.fillStyle = e % 2 === 0 ? '#facc15' : '#f97316';
        ctx.fillRect(ex, ey, 3, 3);
      }

      if (custom?.overlayMode !== 'clean') {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText('COZY CAMPFIRE // 60FPS', 8, 14);
      }
      break;
    }
  }

  // Apply Custom Screen Overlays & Filters
  applyLcdCustomOverlays(ctx, custom);

  ctx.restore();
}

/**
 * Generates an array of N ImageData frames for a procedural animation so it can be flashed in 1 click
 */
export function generateProceduralFrames(
  animId: ProceduralAnimId,
  frameCount = 12,
  telemetry?: TelemetryHudMetrics,
  audioSpectrum?: number[],
  custom?: LcdCustomizationOptions
): ImageData[] {
  const offscreen = document.createElement('canvas');
  offscreen.width = LCD_WIDTH;
  offscreen.height = LCD_HEIGHT;
  const ctx = offscreen.getContext('2d')!;

  const frames: ImageData[] = [];
  for (let f = 0; f < frameCount; f++) {
    drawProceduralAnimationFrame(ctx, animId, f, telemetry, audioSpectrum, custom);
    frames.push(ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT));
  }
  return frames;
}

/**
 * Renders a 240x135 Rotary Knob Active Mode OSD banner
 */
export function renderSmartKnobOsdFrame(
  modeTitle: string,
  ccwLabel: string,
  clickLabel: string,
  cwLabel: string,
  accentHex: string
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, LCD_WIDTH - 6, LCD_HEIGHT - 6);

  ctx.fillStyle = '#131b2e';
  ctx.fillRect(6, 6, LCD_WIDTH - 12, 24);
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.fillText('ROTARY KNOB // ACTIVE OSD', 12, 21);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(modeTitle.toUpperCase(), 14, 52);

  const boxes = [
    { pos: '7,0 CCW', val: ccwLabel, x: 10 },
    { pos: '0,14 PUSH', val: clickLabel, x: 85 },
    { pos: '7,1 CW', val: cwLabel, x: 160 },
  ];

  boxes.forEach((b) => {
    ctx.fillStyle = '#131b2e';
    ctx.fillRect(b.x, 66, 70, 54);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, 66, 70, 54);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText(b.pos, b.x + 6, 81);

    ctx.fillStyle = accentHex;
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText(b.val.slice(0, 8), b.x + 6, 104);
  });

  return ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
}

/**
 * Renders a stylized 240x135 Pokémon frame in 4 selectable 240x135 GMK87 screen layouts:
 * - 'pokedex-hud' (Classic Pokédex battle card + HP bar + right arena)
 * - 'fullscreen-cinema' (Centered oversized sprite over neon radial arena)
 * - 'split-clock-sprite' (Left digital clock & date + Right animated sprite)
 * - 'wanted-bounty' (Cyberpunk Wanted / Bounty card)
 */
export function renderPokemonLcdFrame(
  pokemonId: number,
  name: string,
  typeLabel: string,
  accentColor: string,
  shiny: boolean,
  loadedImage?: HTMLImageElement | null,
  framePhase = 0,
  custom?: LcdCustomizationOptions
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const layout = custom?.pokemonLayout || 'pokedex-hud';
  const bobY = Math.round(Math.sin(framePhase * 0.6) * 3);

  const drawSpriteAt = (cx: number, cy: number, maxDim: number) => {
    if (loadedImage && loadedImage.complete && loadedImage.naturalWidth > 0) {
      const scale = Math.min(maxDim / loadedImage.naturalWidth, maxDim / loadedImage.naturalHeight);
      const dw = Math.round(loadedImage.naturalWidth * scale);
      const dh = Math.round(loadedImage.naturalHeight * scale);
      const dx = Math.round(cx - dw / 2);
      const dy = Math.round(cy - dh / 2) + bobY;
      try {
        ctx.drawImage(loadedImage, dx, dy, dw, dh);
      } catch {
        // Fallback if tainted
      }
    } else {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy + bobY, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (layout === 'fullscreen-cinema') {
    const rad = ctx.createRadialGradient(120, 68, 8, 120, 68, 110);
    rad.addColorStop(0, '#1e293b');
    rad.addColorStop(1, '#050811');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(120, 112, 64, 14, 0, 0, Math.PI * 2);
    ctx.stroke();

    drawSpriteAt(120, 66, 108);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(`${name.toUpperCase()} ${shiny ? '★' : ''}`, 8, 127);
  } else if (layout === 'split-clock-sprite') {
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

    // Draw sprite on right side
    ctx.strokeStyle = accentColor;
    ctx.beginPath();
    ctx.ellipse(166, 110, 46, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawSpriteAt(166, 66, 88);

    // Force split clock on left
    applyLcdCustomOverlays(ctx, {
      ...(custom || DEFAULT_LCD_CUSTOMIZATION),
      overlayMode: 'split-clock',
      customTagText: `#${pokemonId} ${name.toUpperCase()}`,
    });
    return ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
  } else if (layout === 'wanted-bounty') {
    ctx.fillStyle = '#0b0914';
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, LCD_WIDTH - 8, LCD_HEIGHT - 8);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText('WANTED // BOUNTY TARGET', 14, 22);

    drawSpriteAt(68, 76, 78);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(name.toUpperCase(), 122, 54);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(typeLabel.toUpperCase(), 122, 72);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(`¥${pokemonId * 12500}`, 122, 96);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText(custom?.customTagText || 'GMK87 HUNTER GUILD', 122, 116);
  } else {
    // Default 'pokedex-hud'
    const grad = ctx.createLinearGradient(0, 0, LCD_WIDTH, LCD_HEIGHT);
    grad.addColorStop(0, '#090d1a');
    grad.addColorStop(1, '#18182f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

    ctx.fillStyle = 'rgba(6, 182, 212, 0.16)';
    ctx.beginPath();
    ctx.ellipse(165, 108, 48, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#131b2e';
    ctx.fillRect(8, 12, 106, 62);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 12, 106, 62);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText(`#${String(pokemonId).padStart(3, '0')} ${shiny ? '★ SHINY' : 'DEX'}`, 14, 26);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(name.toUpperCase(), 14, 44);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(typeLabel, 14, 58);

    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(14, 64, 92, 4);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(14, 64, 86, 4);

    drawSpriteAt(165, 66, 82);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(8, 114, 106, 14);
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText(custom?.customTagText.slice(0, 16) || 'GMK87 // 240x135', 12, 124);
  }

  applyLcdCustomOverlays(ctx, custom);
  return ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
}
