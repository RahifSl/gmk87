export interface EcosystemComparisonRow {
  app: string;
  vendor: string;
  keyRemapping: string;
  lcdScreenSupport: string;
  liveTelemetryOsd: string;
  crossPlatformWebHid: string;
  rgb565Dithering: string;
  verdictForGmk87: string;
}

export const KEYBOARD_APPS_COMPARISON: EcosystemComparisonRow[] = [
  {
    app: 'Stock Zuoya / Epomaker Image Tool',
    vendor: 'Zuoya / Rongyuan (.exe)',
    keyRemapping: 'None (requires separate VIA app)',
    lcdScreenSupport: 'Basic GIF/JPG upload (harsh color banding)',
    liveTelemetryOsd: 'None (only static BCD clock)',
    crossPlatformWebHid: 'Windows-only legacy installer',
    rgb565Dithering: 'No (truncates bits directly)',
    verdictForGmk87: 'Fragmented & Windows-locked; crashes on unpadded >16 frame transfers.',
  },
  {
    app: 'VIA Web App (usevia.app)',
    vendor: 'Open-Source / QMK',
    keyRemapping: 'Full Protocol 9 (requires manual JSON sideload)',
    lcdScreenSupport: 'None (ignores usagePage 0xFF1C)',
    liveTelemetryOsd: 'None',
    crossPlatformWebHid: 'Yes (Chromium WebHID)',
    rgb565Dithering: 'N/A',
    verdictForGmk87: 'Annoying JSON sideloading every session; cannot control TFT screen or clock.',
  },
  {
    app: 'Vial (get.vial.today)',
    vendor: 'Vial Open-Source',
    keyRemapping: 'Advanced Tap-Dance, Combos, Rotary Encoder',
    lcdScreenSupport: 'None for proprietary 0xFF1C controllers',
    liveTelemetryOsd: 'None',
    crossPlatformWebHid: 'Yes (Web + Desktop)',
    rgb565Dithering: 'N/A',
    verdictForGmk87: 'Stock GMK87 firmware runs VIA Protocol 9 without Vial UID descriptor.',
  },
  {
    app: 'Wootility v4 / v5',
    vendor: 'Wooting',
    keyRemapping: 'Instant WebHID + Profile Sharing',
    lcdScreenSupport: 'N/A (No TFT on Wooting)',
    liveTelemetryOsd: 'Gamepad / Analog curve HUD',
    crossPlatformWebHid: 'Gold-standard zero-install WebHID',
    rgb565Dithering: 'N/A',
    verdictForGmk87: 'Benchmark UX architecture that inspired our zero-install GMK87 WebHID studio.',
  },
  {
    app: 'SteelSeries GG (Apex OLED) / ASUS Armoury Crate',
    vendor: 'SteelSeries / ASUS ROG',
    keyRemapping: 'Proprietary heavy background daemon',
    lcdScreenSupport: 'Monochrome or Color OLED applets',
    liveTelemetryOsd: 'CPU/RAM/Temp HUD, Media OSD, Timers',
    crossPlatformWebHid: 'No (1GB+ bloatware installer)',
    rgb565Dithering: 'Proprietary',
    verdictForGmk87: 'Great OLED applets, terrible 1GB bloatware. We ported their best HUD applets to pure WebHID.',
  },
  {
    app: 'GMK87 Master Control Center (Ours)',
    vendor: 'Unified Dual-Endpoint WebHID',
    keyRemapping: 'Built-in 87-Key + Knob VIA Protocol 9 (No JSON needed)',
    lcdScreenSupport: 'Full 240×135 RGB565 + Procedural & Pokémon Studio',
    liveTelemetryOsd: 'CPU/RAM HUD, 24-Band Audio DSP, Knob Mode OSD, WPM & Pomodoro',
    crossPlatformWebHid: '100% Browser WebHID (Win / Mac / Linux) + Sim Fallback',
    rgb565Dithering: 'Floyd-Steinberg Error-Diffusion Dithering',
    verdictForGmk87: 'Unifies 0xFF1C (LCD) + 0xFF60 (VIA) in one zero-bloat studio.',
  },
];

export interface FixAndInnovationItem {
  id: string;
  type: 'fix' | 'beyond-zuoya';
  title: string;
  hardwareMechanism: string;
  problemOrOpportunity: string;
  howWeSolvedIt: string;
  targetTab: string;
}

export const GMK87_FIXES_AND_INNOVATIONS: FixAndInnovationItem[] = [
  {
    id: 'fix-1',
    type: 'fix',
    title: 'Eliminate Manual VIA JSON Sideloading & Split-App Friction',
    hardwareMechanism: 'Dual WebHID Endpoints: 0xFF60 (VIA Protocol 9) + 0xFF1C (LCD Report 0x04)',
    problemOrOpportunity:
      'GMK87 owners normally have to use usevia.app (and manually upload a wired JSON definition file every time) to remap keys, then close Chrome and open a sketchy Windows-only .exe to change the screen or sync the clock.',
    howWeSolvedIt:
      'We baked the exact 8-Row × 15-Col GMK87 physical matrix and rotary encoder coordinates ([7,0] CCW, [0,14] Click, [7,1] CW) directly into the app and open both 0xFF60 and 0xFF1C interfaces simultaneously.',
    targetTab: 'keymap',
  },
  {
    id: 'fix-2',
    type: 'fix',
    title: 'Fix RGB565 Gradient Banding with Floyd-Steinberg Dithering',
    hardwareMechanism: '16-bit Big-Endian RGB565 Quantizer (5-bit R, 6-bit G, 5-bit B)',
    problemOrOpportunity:
      'Because the GMK87 TFT uses 16-bit RGB565 (65,536 colors instead of 16.7M), the stock Zuoya tool simply truncates the lower bits ((r>>3)<<11 | (g>>2)<<5 | (b>>3)), causing ugly staircase banding on dark cyberpunk gradients and anime/Pokémon art.',
    howWeSolvedIt:
      'We implemented an optional Floyd-Steinberg Error-Diffusion Dithering pass before RGB565 packing, diffusing quantization error across neighboring pixels (7/16, 3/16, 5/16, 1/16) for smooth perceived 24-bit gradients.',
    targetTab: 'uploader',
  },
  {
    id: 'fix-3',
    type: 'fix',
    title: 'Fix Corrupted Frame Uploads via Strict 64KB Alignment & 25ms Flash Yield',
    hardwareMechanism: '64,800B Frame → 65,536B (0x10000) Boundary Padding + 56B Chunk Checksum',
    problemOrOpportunity:
      'Third-party scripts often brick or garble Slot 0 / Slot 1 animations because the GMK87 SPI flash erases on 64KB boundaries while a raw 240×135×2 frame is 64,800 bytes.',
    howWeSolvedIt:
      'Every frame buffer is zero-padded to exactly 65,536 bytes, signed with a 16-bit little-endian sum over bytes 3..63, and pauses 25ms at every 65,536B page boundary so the onboard MCU never drops packets.',
    targetTab: 'gifs',
  },
  {
    id: 'fix-4',
    type: 'fix',
    title: 'Fix RTC Clock Drift with 15-Minute Auto-Sync Daemon',
    hardwareMechanism: 'Config Buffer Offsets cfg[35..41] BCD-Encoded Real-Time Clock',
    problemOrOpportunity:
      'The GMK87 internal crystal drifts by several minutes per month, and Daylight Saving Time requires opening the Windows tool.',
    howWeSolvedIt:
      'Added a 1-click BCD time synchronizer plus a background 15-minute auto-sync toggle that keeps cfg[35..41] locked to your PC system clock.',
    targetTab: 'clock',
  },
  {
    id: 'beyond-1',
    type: 'beyond-zuoya',
    title: 'Smart Rotary Knob Multi-Engine with Live LCD Mode OSD',
    hardwareMechanism: 'Simultaneous VIA 0x05 Keycode Swap + 0xFF1C 0x21 Frame Push',
    problemOrOpportunity:
      'On stock GMK87, the rotary knob only does Volume Up/Down/Mute on Layer 0, and if you remap it, the screen never tells you what mode the knob is currently in.',
    howWeSolvedIt:
      'Clicking Volume, Media Player, Timeline Scrubber, or Zoom Mode in our Smart Knob tab dynamically rewrites VIA Layer 0 [7,0], [0,14], and [7,1] AND flashes a custom 240×135 Rotary Knob OSD card to the keyboard screen.',
    targetTab: 'knob',
  },
  {
    id: 'beyond-2',
    type: 'beyond-zuoya',
    title: 'Web Audio API Microphone / System Audio 24-Band Spectrum Capture',
    hardwareMechanism: 'AnalyserNode FFT → 24-Band RGB565 Canvas → 16-Frame Loop Flasher',
    problemOrOpportunity:
      'Zuoya has no audio visualizer for the TFT screen.',
    howWeSolvedIt:
      'Uses browser Web Audio API (or built-in synth demo) to drive a dual-layer 24-band neon spectrum + oscilloscope and records a 16-frame hardware loop directly into Slot 0 or Slot 1.',
    targetTab: 'telemetry',
  },
  {
    id: 'beyond-3',
    type: 'beyond-zuoya',
    title: 'Live WPM Typing Tachometer & Pomodoro Focus Timer on LCD',
    hardwareMechanism: 'Real-Time DOM Keystroke Counter / Countdown → 240×135 HUD Streamer',
    problemOrOpportunity:
      'High-end boards like Asus Azoth and Finalmouse Centerpiece display live typing speed (WPM) or focus timers, which Zuoya lacks.',
    howWeSolvedIt:
      'Built an interactive WPM Typing Speedometer & Hardware Pomodoro Timer in the Ecosystem Lab that renders your real-time WPM gauge and countdown directly onto the 240×135 RGB565 monitor and flashes it to the keyboard.',
    targetTab: 'ecosystem',
  },
];
