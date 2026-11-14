# GMK87 Master Control Center — Project Handoff & Continuity Guide

This document captures the complete state, specifications, and architecture of the **Zuoya GMK87 Master Control Center** so any AI session or developer can immediately resume work without losing context.

---

## 1. Project Overview & Target Hardware

- **Application**: **GMK87 Master Control Center**
- **Hardware Target**: **Zuoya GMK87** 80% Tenkeyless (TKL) Custom Gasket Mechanical Keyboard
- **USB Identifiers**:
  - `Vendor ID (VID)`: `0x320F`
  - `Product ID (PID)`: `0x5055`
  - `VIA Protocol`: Version 9 (`0xFF60` Usage Page, `0x00` Report ID)
  - `TFT Color LCD`: 240×135 RGB565 (`0xFF1C` Usage Page, `0x04` Report ID, 56B packet chunks)
- **User's Physical Hardware & Keycap Configuration**:
  - **Keycap Set**: **GMK Awaken (Neo Tokyo by biip)** with custom **Electric Yellow Spacebar**
  - **Alphas**: Deep matte charcoal base with electric yellow Latin letters + authentic Japanese Katakana sublegends (`Q タ`, `W テ`, `E イ`, `R ス`, `A チ`, etc.)
  - **Spacebar**: Solid vibrant electric yellow (`#facc15`)
  - **Enter**: Crimson red with neon audio waveform telemetry (`∿∿∿∿∿`)
  - **Backspace**: Electric cyan with digital chevron gauge (`<<<<<<`)
  - **Esc**: Neon red with triangular tech icon (`△`)
  - **Function Row**: F1–F4 yellow, F5–F8 cyan, F9–F12 yellow, PrtSc target crosshair (`⊕`)
  - **Modifiers & Nav**: Cyan cybernetic telemetry glyphs
  - **Arrow Keys**: Matte black with high-contrast red arrows (`▲`, `◄`, `▼`, `►`)
  - **Hardware Light Bar**: GMK87's signature glowing horizontal RGB strip situated between the 6-key nav cluster and the arrow keys
  - **Top-Right Module**: 240×135 TFT display and CNC aluminum knurled volume knob side-by-side in top-right corner

---

## 2. Key Completed Features & Fixes

1. **Physical Layout Authentic to Zuoya GMK87**:
   - Filtered out the 3 fake knob square keycaps from row 0 (`↺ CCW`, `● CLICK`, `↻ CW`).
   - Positioned the CNC knurled aluminum rotary knob at top-right with interactive rotation and click mute.
   - Embedded the 240×135 TFT screen with exact 16:9 native aspect ratio (`96px × 54px` in chassis).
   - Cleaned keycap typography: removed developer matrix coordinates (`0,0`, `1,14`) and redundant duplicate text.
   - Added the GMK87 signature hardware RGB LED strip bar between the nav cluster and arrow keys.

2. **240×135 Screen Dimensions & Zero-Empty-Space Cover**:
   - Updated `renderSourceToLcdFrame` in `src/utils/gifDecoder.ts` to use cover scaling (`Math.max`).
   - All GIFs, uploaded images, and web animations scale proportionally with **no stretching** and fill the 240×135 dimensions edge-to-edge with **zero empty space or black borders**.

3. **Calm Screen Display & Play/Pause Controls**:
   - Replaced rapid typing cat default with the calm **`cyber-hud`** (live time, CPU/RAM, and GMK87 status).
   - Added a **`LIVE / PAUSED`** toggle button in the top header ribbon and monitors to freeze/unfreeze screen animations at any time.
   - Slowed down bongo-cat animation cadence by 4x for smooth, gentle movement.

4. **Decluttered Studios**:
   - Tab 1: Clean Key Remapper with selected key inspector, 1-click reset, search bar, and spacious category filters.
   - Tab 2: 240×135 Screen Studio with curated presets, live Pokémon arena, endless web GIF search, and flash engine.
   - Tab 7: RGB Underglow Studio with 19 hardware effects, HSV wheel, and live keyboard shader.
   - Tab 8: Smart Rotary Knob Studio with 4 presets (Volume, Media, Scrubber, Zoom).

---

## 3. Repository & Remote Details

- **GitHub Repository**: `https://github.com/RahifSl/gmk87`
- **Main Branch**: `main`
- **Git Author**: `Rahif Sleiman <rahif.sleiman@gmail.com>`
- **Direct Codebase Download**: `public/gmk87-project.zip`

---

## 4. How to Prompt a New Session to Continue

Simply paste this prompt into the new conversation:

> *"I am working on the GMK87 Master Control Center. Please read `PROJECT_CONTEXT.md` in the workspace to see where we left off. My keyboard is a Zuoya GMK87 with GMK Awaken keycaps (yellow spacebar) and GitHub repo https://github.com/RahifSl/gmk87. Let's continue from here."*
