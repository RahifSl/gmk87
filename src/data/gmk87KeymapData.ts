export interface KeyDefinition {
  id: string;
  label: string;
  row: number;
  col: number;
  x: number; // in key units (1u = 1)
  y: number; // in key units
  w: number; // width in u
  h?: number; // height in u
  isKnob?: boolean;
}

export interface KeycodeItem {
  code: number;
  shortLabel: string;
  name: string;
  category:
    | 'Basic'
    | 'Alpha'
    | 'Number'
    | 'Function'
    | 'Navigation'
    | 'Modifier'
    | 'Media & Knob'
    | 'Layers'
    | 'Lighting & Hardware';
  description?: string;
}

export const KEYCODE_CATALOG: KeycodeItem[] = [
  // Basic
  { code: 0x0000, shortLabel: 'KC_NO', name: 'None (Disabled)', category: 'Basic' },
  { code: 0x0001, shortLabel: '▽ TRNS', name: 'Transparent (Pass-through)', category: 'Basic' },
  { code: 0x0029, shortLabel: 'ESC', name: 'Escape', category: 'Basic' },
  { code: 0x0028, shortLabel: 'ENTER', name: 'Enter / Return', category: 'Basic' },
  { code: 0x002C, shortLabel: 'SPACE', name: 'Spacebar', category: 'Basic' },
  { code: 0x002A, shortLabel: 'BKSP', name: 'Backspace', category: 'Basic' },
  { code: 0x002B, shortLabel: 'TAB', name: 'Tab', category: 'Basic' },
  { code: 0x0039, shortLabel: 'CAPS', name: 'Caps Lock', category: 'Basic' },
  { code: 0x0035, shortLabel: '~ `', name: 'Grave / Tilde', category: 'Basic' },
  { code: 0x002D, shortLabel: '- _', name: 'Minus / Underscore', category: 'Basic' },
  { code: 0x002E, shortLabel: '= +', name: 'Equal / Plus', category: 'Basic' },
  { code: 0x002F, shortLabel: '[ {', name: 'Left Bracket', category: 'Basic' },
  { code: 0x0030, shortLabel: '] }', name: 'Right Bracket', category: 'Basic' },
  { code: 0x0031, shortLabel: '\\ |', name: 'Backslash / Pipe', category: 'Basic' },
  { code: 0x0033, shortLabel: '; :', name: 'Semicolon', category: 'Basic' },
  { code: 0x0034, shortLabel: '\' "', name: 'Quote / Apostrophe', category: 'Basic' },
  { code: 0x0036, shortLabel: ', <', name: 'Comma', category: 'Basic' },
  { code: 0x0037, shortLabel: '. >', name: 'Period', category: 'Basic' },
  { code: 0x0038, shortLabel: '/ ?', name: 'Slash / Question', category: 'Basic' },

  // Alpha
  { code: 0x0004, shortLabel: 'A', name: 'Key A', category: 'Alpha' },
  { code: 0x0005, shortLabel: 'B', name: 'Key B', category: 'Alpha' },
  { code: 0x0006, shortLabel: 'C', name: 'Key C', category: 'Alpha' },
  { code: 0x0007, shortLabel: 'D', name: 'Key D', category: 'Alpha' },
  { code: 0x0008, shortLabel: 'E', name: 'Key E', category: 'Alpha' },
  { code: 0x0009, shortLabel: 'F', name: 'Key F', category: 'Alpha' },
  { code: 0x000A, shortLabel: 'G', name: 'Key G', category: 'Alpha' },
  { code: 0x000B, shortLabel: 'H', name: 'Key H', category: 'Alpha' },
  { code: 0x000C, shortLabel: 'I', name: 'Key I', category: 'Alpha' },
  { code: 0x000D, shortLabel: 'J', name: 'Key J', category: 'Alpha' },
  { code: 0x000E, shortLabel: 'K', name: 'Key K', category: 'Alpha' },
  { code: 0x000F, shortLabel: 'L', name: 'Key L', category: 'Alpha' },
  { code: 0x0010, shortLabel: 'M', name: 'Key M', category: 'Alpha' },
  { code: 0x0011, shortLabel: 'N', name: 'Key N', category: 'Alpha' },
  { code: 0x0012, shortLabel: 'O', name: 'Key O', category: 'Alpha' },
  { code: 0x0013, shortLabel: 'P', name: 'Key P', category: 'Alpha' },
  { code: 0x0014, shortLabel: 'Q', name: 'Key Q', category: 'Alpha' },
  { code: 0x0015, shortLabel: 'R', name: 'Key R', category: 'Alpha' },
  { code: 0x0016, shortLabel: 'S', name: 'Key S', category: 'Alpha' },
  { code: 0x0017, shortLabel: 'T', name: 'Key T', category: 'Alpha' },
  { code: 0x0018, shortLabel: 'U', name: 'Key U', category: 'Alpha' },
  { code: 0x0019, shortLabel: 'V', name: 'Key V', category: 'Alpha' },
  { code: 0x001A, shortLabel: 'W', name: 'Key W', category: 'Alpha' },
  { code: 0x001B, shortLabel: 'X', name: 'Key X', category: 'Alpha' },
  { code: 0x001C, shortLabel: 'Y', name: 'Key Y', category: 'Alpha' },
  { code: 0x001D, shortLabel: 'Z', name: 'Key Z', category: 'Alpha' },

  // Number
  { code: 0x001E, shortLabel: '1 !', name: 'Number 1', category: 'Number' },
  { code: 0x001F, shortLabel: '2 @', name: 'Number 2', category: 'Number' },
  { code: 0x0020, shortLabel: '3 #', name: 'Number 3', category: 'Number' },
  { code: 0x0021, shortLabel: '4 $', name: 'Number 4', category: 'Number' },
  { code: 0x0022, shortLabel: '5 %', name: 'Number 5', category: 'Number' },
  { code: 0x0023, shortLabel: '6 ^', name: 'Number 6', category: 'Number' },
  { code: 0x0024, shortLabel: '7 &', name: 'Number 7', category: 'Number' },
  { code: 0x0025, shortLabel: '8 *', name: 'Number 8', category: 'Number' },
  { code: 0x0026, shortLabel: '9 (', name: 'Number 9', category: 'Number' },
  { code: 0x0027, shortLabel: '0 )', name: 'Number 0', category: 'Number' },

  // Function
  { code: 0x003A, shortLabel: 'F1', name: 'Function 1', category: 'Function' },
  { code: 0x003B, shortLabel: 'F2', name: 'Function 2', category: 'Function' },
  { code: 0x003C, shortLabel: 'F3', name: 'Function 3', category: 'Function' },
  { code: 0x003D, shortLabel: 'F4', name: 'Function 4', category: 'Function' },
  { code: 0x003E, shortLabel: 'F5', name: 'Function 5', category: 'Function' },
  { code: 0x003F, shortLabel: 'F6', name: 'Function 6', category: 'Function' },
  { code: 0x0040, shortLabel: 'F7', name: 'Function 7', category: 'Function' },
  { code: 0x0041, shortLabel: 'F8', name: 'Function 8', category: 'Function' },
  { code: 0x0042, shortLabel: 'F9', name: 'Function 9', category: 'Function' },
  { code: 0x0043, shortLabel: 'F10', name: 'Function 10', category: 'Function' },
  { code: 0x0044, shortLabel: 'F11', name: 'Function 11', category: 'Function' },
  { code: 0x0045, shortLabel: 'F12', name: 'Function 12', category: 'Function' },

  // Navigation
  { code: 0x0046, shortLabel: 'PRTSC', name: 'Print Screen', category: 'Navigation' },
  { code: 0x0047, shortLabel: 'SCRLK', name: 'Scroll Lock', category: 'Navigation' },
  { code: 0x0048, shortLabel: 'PAUSE', name: 'Pause / Break', category: 'Navigation' },
  { code: 0x0049, shortLabel: 'INS', name: 'Insert', category: 'Navigation' },
  { code: 0x004A, shortLabel: 'HOME', name: 'Home', category: 'Navigation' },
  { code: 0x004B, shortLabel: 'PGUP', name: 'Page Up', category: 'Navigation' },
  { code: 0x004C, shortLabel: 'DEL', name: 'Delete', category: 'Navigation' },
  { code: 0x004D, shortLabel: 'END', name: 'End', category: 'Navigation' },
  { code: 0x004E, shortLabel: 'PGDN', name: 'Page Down', category: 'Navigation' },
  { code: 0x004F, shortLabel: 'RIGHT', name: 'Arrow Right', category: 'Navigation' },
  { code: 0x0050, shortLabel: 'LEFT', name: 'Arrow Left', category: 'Navigation' },
  { code: 0x0051, shortLabel: 'DOWN', name: 'Arrow Down', category: 'Navigation' },
  { code: 0x0052, shortLabel: 'UP', name: 'Arrow Up', category: 'Navigation' },

  // Modifier
  { code: 0x00E0, shortLabel: 'LCTL', name: 'Left Control', category: 'Modifier' },
  { code: 0x00E1, shortLabel: 'LSFT', name: 'Left Shift', category: 'Modifier' },
  { code: 0x00E2, shortLabel: 'LALT', name: 'Left Alt / Option', category: 'Modifier' },
  { code: 0x00E3, shortLabel: 'LGUI', name: 'Left Win / Command', category: 'Modifier' },
  { code: 0x00E4, shortLabel: 'RCTL', name: 'Right Control', category: 'Modifier' },
  { code: 0x00E5, shortLabel: 'RSFT', name: 'Right Shift', category: 'Modifier' },
  { code: 0x00E6, shortLabel: 'RALT', name: 'Right Alt / Option', category: 'Modifier' },
  { code: 0x00E7, shortLabel: 'RGUI', name: 'Right Win / Command', category: 'Modifier' },
  { code: 0x012E, shortLabel: 'ZOOM+', name: 'Ctrl + Plus (Zoom In)', category: 'Modifier' },
  { code: 0x012D, shortLabel: 'ZOOM-', name: 'Ctrl + Minus (Zoom Out)', category: 'Modifier' },
  { code: 0x0127, shortLabel: 'ZOOM0', name: 'Ctrl + 0 (Reset Zoom)', category: 'Modifier' },

  // Media & Knob
  { code: 0x00A8, shortLabel: 'MUTE', name: 'Audio Mute', category: 'Media & Knob' },
  { code: 0x00A9, shortLabel: 'VOL+', name: 'Audio Volume Up', category: 'Media & Knob' },
  { code: 0x00AA, shortLabel: 'VOL-', name: 'Audio Volume Down', category: 'Media & Knob' },
  { code: 0x00AB, shortLabel: 'NEXT', name: 'Media Next Track', category: 'Media & Knob' },
  { code: 0x00AC, shortLabel: 'PREV', name: 'Media Prev Track', category: 'Media & Knob' },
  { code: 0x00AD, shortLabel: 'STOP', name: 'Media Stop', category: 'Media & Knob' },
  { code: 0x00AE, shortLabel: 'PLAY', name: 'Media Play / Pause', category: 'Media & Knob' },
  { code: 0x00BD, shortLabel: 'BRI+', name: 'Screen Brightness Up', category: 'Media & Knob' },
  { code: 0x00BE, shortLabel: 'BRI-', name: 'Screen Brightness Down', category: 'Media & Knob' },
  { code: 0x00B1, shortLabel: 'MAIL', name: 'Launch Mail Client', category: 'Media & Knob' },
  { code: 0x00B2, shortLabel: 'CALC', name: 'Launch Calculator', category: 'Media & Knob' },
  { code: 0x00B3, shortLabel: 'MYCMP', name: 'My Computer / Explorer', category: 'Media & Knob' },

  // Layers (GMK87 Protocol 9 defaults + Protocol 11 V0112 codes)
  { code: 0x5F10, shortLabel: 'FN', name: 'GMK87 Hardware Fn Key', category: 'Layers' },
  { code: 0x5101, shortLabel: 'MO(1)', name: 'Momentary Layer 1 (Win Fn)', category: 'Layers' },
  { code: 0x5102, shortLabel: 'MO(2)', name: 'Momentary Layer 2 (Mac)', category: 'Layers' },
  { code: 0x5103, shortLabel: 'MO(3)', name: 'Momentary Layer 3 (Mac Fn)', category: 'Layers' },
  { code: 0x5010, shortLabel: 'TO(0)', name: 'Switch to Layer 0', category: 'Layers' },
  { code: 0x5011, shortLabel: 'TO(1)', name: 'Switch to Layer 1', category: 'Layers' },
  { code: 0x5012, shortLabel: 'TO(2)', name: 'Switch to Layer 2', category: 'Layers' },
  { code: 0x5013, shortLabel: 'TO(3)', name: 'Switch to Layer 3', category: 'Layers' },
  { code: 0x5221, shortLabel: 'MO1_V11', name: 'Momentary Layer 1 (V0112)', category: 'Layers' },
  { code: 0x5223, shortLabel: 'MO3_V11', name: 'Momentary Layer 3 (V0112)', category: 'Layers' },

  // Lighting & Hardware (Verified GMK87 V0104 Protocol 9 EEPROM codes)
  { code: 0x5CC2, shortLabel: 'RGB_TOG', name: 'RGB Toggle On/Off', category: 'Lighting & Hardware' },
  { code: 0x5CC3, shortLabel: 'RGB_MOD', name: 'RGB Mode Next', category: 'Lighting & Hardware' },
  { code: 0x5CC4, shortLabel: 'RGB_RMOD', name: 'RGB Mode Previous', category: 'Lighting & Hardware' },
  { code: 0x5CC5, shortLabel: 'RGB_HUI', name: 'RGB Hue Increase', category: 'Lighting & Hardware' },
  { code: 0x5CC6, shortLabel: 'RGB_HUD', name: 'RGB Hue Decrease', category: 'Lighting & Hardware' },
  { code: 0x5CC7, shortLabel: 'RGB_SAI', name: 'RGB Saturation Up', category: 'Lighting & Hardware' },
  { code: 0x5CC8, shortLabel: 'RGB_SAD', name: 'RGB Saturation Down', category: 'Lighting & Hardware' },
  { code: 0x5CC9, shortLabel: 'RGB_VAI', name: 'RGB Brightness Up', category: 'Lighting & Hardware' },
  { code: 0x5CCA, shortLabel: 'RGB_VAD', name: 'RGB Brightness Down', category: 'Lighting & Hardware' },
  { code: 0x5CCB, shortLabel: 'RGB_SPI', name: 'RGB Speed Up', category: 'Lighting & Hardware' },
  { code: 0x5CCC, shortLabel: 'RGB_SPD', name: 'RGB Speed Down', category: 'Lighting & Hardware' },
  { code: 0x5F81, shortLabel: 'BT_1', name: 'Bluetooth Host 1', category: 'Lighting & Hardware' },
  { code: 0x5F82, shortLabel: 'BT_2', name: 'Bluetooth Host 2', category: 'Lighting & Hardware' },
  { code: 0x5F83, shortLabel: 'BT_3', name: 'Bluetooth Host 3', category: 'Lighting & Hardware' },
  { code: 0x5F80, shortLabel: '2.4G', name: '2.4GHz Wireless Dongle', category: 'Lighting & Hardware' },
  { code: 0x5F84, shortLabel: 'WIN_LCK', name: 'Lock Windows Key', category: 'Lighting & Hardware' },
  { code: 0x5F87, shortLabel: 'LOGO_MOD', name: 'Logo LED Mode', category: 'Lighting & Hardware' },
  { code: 0x5F88, shortLabel: 'LOGO_CLR', name: 'Logo LED Color', category: 'Lighting & Hardware' },
  { code: 0x5F89, shortLabel: 'LCD_NXT', name: 'TFT Next Slot / Mode', category: 'Lighting & Hardware' },
  { code: 0x5F8B, shortLabel: 'LCD_PWR', name: 'TFT Screen Power Toggle', category: 'Lighting & Hardware' },
  { code: 0x5C00, shortLabel: 'RESET_P9', name: 'Factory Reset (P9)', category: 'Lighting & Hardware' },
  { code: 0x7C00, shortLabel: 'QK_BOOT', name: 'Bootloader / Reset (V11)', category: 'Lighting & Hardware' },
];

export const KEYCODE_BY_CODE = new Map<number, KeycodeItem>(
  KEYCODE_CATALOG.map((item) => [item.code, item])
);

export function getKeycodeLabel(code: number, viaProtocol = 9): string {
  const found = KEYCODE_BY_CODE.get(code);
  if (found) return found.shortLabel;
  if (code === 0) return 'NONE';
  if (code >= 0x5100 && code <= 0x510f) return `MO(${code & 0x0f})`;
  if (code >= 0x5010 && code <= 0x501f) return `TO(${code & 0x0f})`;
  if (viaProtocol >= 11 && code >= 0x5220 && code <= 0x523f) return `MO(${code & 0x1f})`;
  if (code >= 0x5200 && code <= 0x521f) return `TO(${code & 0x1f})`;
  if (code >= 0x0100 && code <= 0x1fff) {
    const inner = KEYCODE_BY_CODE.get(code & 0xff)?.shortLabel ?? `0x${(code & 0xff).toString(16)}`;
    return `MOD+${inner}`;
  }
  return `0x${code.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Physical 87-key TKL Layout + 3 Rotary Knob Actions for Zuoya GMK87
 * Matrix is 8 Rows x 15 Cols.
 * Rotary Knob positions:
 * - Turn CCW: [Row 7, Col 0]
 * - Knob Click: [Row 0, Col 14]
 * - Turn CW: [Row 7, Col 1]
 */
export const GMK87_PHYSICAL_KEYS: KeyDefinition[] = [
  // Row 0: Function Row + Rotary Knob Cluster at top right
  { id: 'r0c0', label: 'Esc', row: 0, col: 0, x: 0, y: 0, w: 1 },
  { id: 'r0c1', label: 'F1', row: 0, col: 1, x: 1.5, y: 0, w: 1 },
  { id: 'r0c2', label: 'F2', row: 0, col: 2, x: 2.5, y: 0, w: 1 },
  { id: 'r0c3', label: 'F3', row: 0, col: 3, x: 3.5, y: 0, w: 1 },
  { id: 'r0c4', label: 'F4', row: 0, col: 4, x: 4.5, y: 0, w: 1 },
  { id: 'r0c5', label: 'F5', row: 0, col: 5, x: 6, y: 0, w: 1 },
  { id: 'r0c6', label: 'F6', row: 0, col: 6, x: 7, y: 0, w: 1 },
  { id: 'r0c7', label: 'F7', row: 0, col: 7, x: 8, y: 0, w: 1 },
  { id: 'r0c8', label: 'F8', row: 0, col: 8, x: 9, y: 0, w: 1 },
  { id: 'r0c9', label: 'F9', row: 0, col: 9, x: 10.5, y: 0, w: 1 },
  { id: 'r0c10', label: 'F10', row: 0, col: 10, x: 11.5, y: 0, w: 1 },
  { id: 'r0c11', label: 'F11', row: 0, col: 11, x: 12.5, y: 0, w: 1 },
  { id: 'r0c12', label: 'F12', row: 0, col: 12, x: 13.5, y: 0, w: 1 },
  { id: 'r0c13', label: 'PrtSc', row: 0, col: 13, x: 14.65, y: 0, w: 1 },
  // Rotary Knob actions (handled via CNC encoder dial overlay, filtered out of keycap array)
  { id: 'r7c0', label: '↺ CCW', row: 7, col: 0, x: 17.4, y: 0, w: 1, isKnob: true },
  { id: 'r0c14', label: '● CLICK', row: 0, col: 14, x: 17.4, y: 0, w: 1, isKnob: true },
  { id: 'r7c1', label: '↻ CW', row: 7, col: 1, x: 17.4, y: 0, w: 1, isKnob: true },

  // Row 1: Number Row + Nav Top Row (Ins, Home, PgUp)
  { id: 'r1c0', label: '~ `', row: 1, col: 0, x: 0, y: 1.35, w: 1 },
  { id: 'r1c1', label: '1', row: 1, col: 1, x: 1, y: 1.35, w: 1 },
  { id: 'r1c2', label: '2', row: 1, col: 2, x: 2, y: 1.35, w: 1 },
  { id: 'r1c3', label: '3', row: 1, col: 3, x: 3, y: 1.35, w: 1 },
  { id: 'r1c4', label: '4', row: 1, col: 4, x: 4, y: 1.35, w: 1 },
  { id: 'r1c5', label: '5', row: 1, col: 5, x: 5, y: 1.35, w: 1 },
  { id: 'r1c6', label: '6', row: 1, col: 6, x: 6, y: 1.35, w: 1 },
  { id: 'r1c7', label: '7', row: 1, col: 7, x: 7, y: 1.35, w: 1 },
  { id: 'r1c8', label: '8', row: 1, col: 8, x: 8, y: 1.35, w: 1 },
  { id: 'r1c9', label: '9', row: 1, col: 9, x: 9, y: 1.35, w: 1 },
  { id: 'r1c10', label: '0', row: 1, col: 10, x: 10, y: 1.35, w: 1 },
  { id: 'r1c11', label: '-', row: 1, col: 11, x: 11, y: 1.35, w: 1 },
  { id: 'r1c12', label: '=', row: 1, col: 12, x: 12, y: 1.35, w: 1 },
  { id: 'r1c13', label: 'Backspace', row: 1, col: 13, x: 13, y: 1.35, w: 2 },
  { id: 'r1c14', label: 'Ins', row: 1, col: 14, x: 15.25, y: 1.35, w: 1 },
  { id: 'r3c14', label: 'Home', row: 3, col: 14, x: 16.25, y: 1.35, w: 1 },
  { id: 'r5c14', label: 'PgUp', row: 5, col: 14, x: 17.25, y: 1.35, w: 1 },

  // Row 2: QWERTY Row + Nav Bottom Row (Del, End, PgDn)
  { id: 'r2c0', label: 'Tab', row: 2, col: 0, x: 0, y: 2.35, w: 1.5 },
  { id: 'r2c1', label: 'Q', row: 2, col: 1, x: 1.5, y: 2.35, w: 1 },
  { id: 'r2c2', label: 'W', row: 2, col: 2, x: 2.5, y: 2.35, w: 1 },
  { id: 'r2c3', label: 'E', row: 2, col: 3, x: 3.5, y: 2.35, w: 1 },
  { id: 'r2c4', label: 'R', row: 2, col: 4, x: 4.5, y: 2.35, w: 1 },
  { id: 'r2c5', label: 'T', row: 2, col: 5, x: 5.5, y: 2.35, w: 1 },
  { id: 'r2c6', label: 'Y', row: 2, col: 6, x: 6.5, y: 2.35, w: 1 },
  { id: 'r2c7', label: 'U', row: 2, col: 7, x: 7.5, y: 2.35, w: 1 },
  { id: 'r2c8', label: 'I', row: 2, col: 8, x: 8.5, y: 2.35, w: 1 },
  { id: 'r2c9', label: 'O', row: 2, col: 9, x: 9.5, y: 2.35, w: 1 },
  { id: 'r2c10', label: 'P', row: 2, col: 10, x: 10.5, y: 2.35, w: 1 },
  { id: 'r2c11', label: '[', row: 2, col: 11, x: 11.5, y: 2.35, w: 1 },
  { id: 'r2c12', label: ']', row: 2, col: 12, x: 12.5, y: 2.35, w: 1 },
  { id: 'r2c13', label: '\\', row: 2, col: 13, x: 13.5, y: 2.35, w: 1.5 },
  { id: 'r2c14', label: 'Del', row: 2, col: 14, x: 15.25, y: 2.35, w: 1 },
  { id: 'r4c14', label: 'End', row: 4, col: 14, x: 16.25, y: 2.35, w: 1 },
  { id: 'r6c14', label: 'PgDn', row: 6, col: 14, x: 17.25, y: 2.35, w: 1 },

  // Row 3: ASDF Row (clean gasket plate below nav cluster)
  { id: 'r3c0', label: 'Caps', row: 3, col: 0, x: 0, y: 3.35, w: 1.75 },
  { id: 'r3c1', label: 'A', row: 3, col: 1, x: 1.75, y: 3.35, w: 1 },
  { id: 'r3c2', label: 'S', row: 3, col: 2, x: 2.75, y: 3.35, w: 1 },
  { id: 'r3c3', label: 'D', row: 3, col: 3, x: 3.75, y: 3.35, w: 1 },
  { id: 'r3c4', label: 'F', row: 3, col: 4, x: 4.75, y: 3.35, w: 1 },
  { id: 'r3c5', label: 'G', row: 3, col: 5, x: 5.75, y: 3.35, w: 1 },
  { id: 'r3c6', label: 'H', row: 3, col: 6, x: 6.75, y: 3.35, w: 1 },
  { id: 'r3c7', label: 'J', row: 3, col: 7, x: 7.75, y: 3.35, w: 1 },
  { id: 'r3c8', label: 'K', row: 3, col: 8, x: 8.75, y: 3.35, w: 1 },
  { id: 'r3c9', label: 'L', row: 3, col: 9, x: 9.75, y: 3.35, w: 1 },
  { id: 'r3c10', label: ';', row: 3, col: 10, x: 10.75, y: 3.35, w: 1 },
  { id: 'r3c11', label: "'", row: 3, col: 11, x: 11.75, y: 3.35, w: 1 },
  { id: 'r3c13', label: 'Enter', row: 3, col: 13, x: 12.75, y: 3.35, w: 2.25 },

  // Row 4: ZXCV Row + Up Arrow
  { id: 'r4c0', label: 'LShift', row: 4, col: 0, x: 0, y: 4.35, w: 2.25 },
  { id: 'r4c2', label: 'Z', row: 4, col: 2, x: 2.25, y: 4.35, w: 1 },
  { id: 'r4c3', label: 'X', row: 4, col: 3, x: 3.25, y: 4.35, w: 1 },
  { id: 'r4c4', label: 'C', row: 4, col: 4, x: 4.25, y: 4.35, w: 1 },
  { id: 'r4c5', label: 'V', row: 4, col: 5, x: 5.25, y: 4.35, w: 1 },
  { id: 'r4c6', label: 'B', row: 4, col: 6, x: 6.25, y: 4.35, w: 1 },
  { id: 'r4c7', label: 'N', row: 4, col: 7, x: 7.25, y: 4.35, w: 1 },
  { id: 'r4c8', label: 'M', row: 4, col: 8, x: 8.25, y: 4.35, w: 1 },
  { id: 'r4c9', label: ',', row: 4, col: 9, x: 9.25, y: 4.35, w: 1 },
  { id: 'r4c10', label: '.', row: 4, col: 10, x: 10.25, y: 4.35, w: 1 },
  { id: 'r4c11', label: '/', row: 4, col: 11, x: 11.25, y: 4.35, w: 1 },
  { id: 'r4c12', label: 'RShift', row: 4, col: 12, x: 12.25, y: 4.35, w: 2.75 },
  { id: 'r4c13', label: '▲', row: 4, col: 13, x: 16.25, y: 4.35, w: 1 },

  // Row 5: Bottom Modifiers + Arrow Cluster
  { id: 'r5c0', label: 'LCtrl', row: 5, col: 0, x: 0, y: 5.35, w: 1.25 },
  { id: 'r5c1', label: 'Win', row: 5, col: 1, x: 1.25, y: 5.35, w: 1.25 },
  { id: 'r5c2', label: 'LAlt', row: 5, col: 2, x: 2.5, y: 5.35, w: 1.25 },
  { id: 'r5c6', label: 'Space', row: 5, col: 6, x: 3.75, y: 5.35, w: 6.25 },
  { id: 'r5c9', label: 'RAlt', row: 5, col: 9, x: 10, y: 5.35, w: 1.25 },
  { id: 'r5c10', label: 'Fn', row: 5, col: 10, x: 11.25, y: 5.35, w: 1.25 },
  { id: 'r5c11', label: 'Menu', row: 5, col: 11, x: 12.5, y: 5.35, w: 1.25 },
  { id: 'r5c12', label: 'RCtrl', row: 5, col: 12, x: 13.75, y: 5.35, w: 1.25 },
  { id: 'r5c13', label: '◄', row: 5, col: 13, x: 15.25, y: 5.35, w: 1 },
  { id: 'r6c12', label: '▼', row: 6, col: 12, x: 16.25, y: 5.35, w: 1 },
  { id: 'r6c13', label: '►', row: 6, col: 13, x: 17.25, y: 5.35, w: 1 },
];

export function createDefaultKeymap(): number[][][] {
  // 4 layers x 8 rows x 15 cols
  const layers: number[][][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 15 }, () => 0x0001))
  );

  // Layer 0 (Win Base)
  const l0 = layers[0];
  l0[0][0] = 0x0029; // Esc
  l0[0][1] = 0x003A; // F1
  l0[0][2] = 0x003B; // F2
  l0[0][3] = 0x003C; // F3
  l0[0][4] = 0x003D; // F4
  l0[0][5] = 0x003E; // F5
  l0[0][6] = 0x003F; // F6
  l0[0][7] = 0x0040; // F7
  l0[0][8] = 0x0041; // F8
  l0[0][9] = 0x0042; // F9
  l0[0][10] = 0x0043; // F10
  l0[0][11] = 0x0044; // F11
  l0[0][12] = 0x0045; // F12
  l0[0][13] = 0x0046; // PrtSc
  l0[0][14] = 0x00A8; // Knob Click -> Mute

  // Knob rotations
  l0[7][0] = 0x00AA; // Knob CCW -> Vol -
  l0[7][1] = 0x00A9; // Knob CW -> Vol +

  // Row 1
  l0[1][0] = 0x0035;
  l0[1][1] = 0x001E;
  l0[1][2] = 0x001F;
  l0[1][3] = 0x0020;
  l0[1][4] = 0x0021;
  l0[1][5] = 0x0022;
  l0[1][6] = 0x0023;
  l0[1][7] = 0x0024;
  l0[1][8] = 0x0025;
  l0[1][9] = 0x0026;
  l0[1][10] = 0x0027;
  l0[1][11] = 0x002D;
  l0[1][12] = 0x002E;
  l0[1][13] = 0x002A; // Backspace
  l0[1][14] = 0x0049; // Ins

  // Row 2
  l0[2][0] = 0x002B; // Tab
  l0[2][1] = 0x0014; // Q
  l0[2][2] = 0x001A; // W
  l0[2][3] = 0x0008; // E
  l0[2][4] = 0x0015; // R
  l0[2][5] = 0x0017; // T
  l0[2][6] = 0x001C; // Y
  l0[2][7] = 0x0018; // U
  l0[2][8] = 0x000C; // I
  l0[2][9] = 0x0012; // O
  l0[2][10] = 0x0013; // P
  l0[2][11] = 0x002F; // [
  l0[2][12] = 0x0030; // ]
  l0[2][13] = 0x0031; // \
  l0[2][14] = 0x004C; // Del

  // Row 3
  l0[3][0] = 0x0039; // Caps
  l0[3][1] = 0x0004; // A
  l0[3][2] = 0x0016; // S
  l0[3][3] = 0x0007; // D
  l0[3][4] = 0x0009; // F
  l0[3][5] = 0x000A; // G
  l0[3][6] = 0x000B; // H
  l0[3][7] = 0x000D; // J
  l0[3][8] = 0x000E; // K
  l0[3][9] = 0x000F; // L
  l0[3][10] = 0x0033; // ;
  l0[3][11] = 0x0034; // '
  l0[3][13] = 0x0028; // Enter
  l0[3][14] = 0x004A; // Home

  // Row 4
  l0[4][0] = 0x00E1; // LShift
  l0[4][2] = 0x001D; // Z
  l0[4][3] = 0x001B; // X
  l0[4][4] = 0x0006; // C
  l0[4][5] = 0x0019; // V
  l0[4][6] = 0x0005; // B
  l0[4][7] = 0x0011; // N
  l0[4][8] = 0x0010; // M
  l0[4][9] = 0x0036; // ,
  l0[4][10] = 0x0037; // .
  l0[4][11] = 0x0038; // /
  l0[4][12] = 0x00E5; // RShift
  l0[4][13] = 0x0052; // Up
  l0[4][14] = 0x004D; // End

  // Row 5 & 6
  l0[5][0] = 0x00E0; // LCtrl
  l0[5][1] = 0x00E3; // LWin
  l0[5][2] = 0x00E2; // LAlt
  l0[5][6] = 0x002C; // Space
  l0[5][9] = 0x00E6; // RAlt
  l0[5][10] = 0x5F10; // GMK87 Hardware Fn Key
  l0[5][11] = 0x00E7; // Menu/RGUI
  l0[5][12] = 0x00E4; // RCtrl
  l0[5][13] = 0x0050; // Left
  l0[5][14] = 0x004B; // PgUp
  l0[6][12] = 0x0051; // Down
  l0[6][13] = 0x004F; // Right
  l0[6][14] = 0x004E; // PgDn

  // Layer 1 (Win Fn — Protocol 9)
  const l1 = layers[1];
  l1[0][0] = 0x5C00; // Fn+Esc Reset
  l1[2][1] = 0x5F81; // Fn+Q BT1
  l1[2][2] = 0x5F82; // Fn+W BT2
  l1[2][3] = 0x5F83; // Fn+E BT3
  l1[2][4] = 0x5F80; // Fn+R 2.4G
  l1[2][13] = 0x5CC3; // Fn+\ RGB Mode
  l1[2][14] = 0x5CC5; // Fn+Del RGB Hue
  l1[1][13] = 0x5CC2; // Fn+Backspace RGB Toggle
  l1[3][13] = 0x5F89; // Fn+Enter Next Screen Slot
  l1[4][12] = 0x5F8B; // Fn+RShift Toggle Screen
  l1[4][13] = 0x5CC9; // Fn+Up RGB Bri+
  l1[6][12] = 0x5CCA; // Fn+Down RGB Bri-
  l1[5][13] = 0x5CCC; // Fn+Left RGB Spd-
  l1[6][13] = 0x5CCB; // Fn+Right RGB Spd+

  // Layer 2 (Mac Base) - copy Layer 0 with swapped Win/Alt
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 15; c++) {
      layers[2][r][c] = l0[r][c];
    }
  }
  layers[2][5][1] = 0x00E2; // LOpt
  layers[2][5][2] = 0x00E3; // LCmd
  layers[2][5][9] = 0x00E7; // RCmd
  layers[2][5][10] = 0x5F10; // Fn

  // Layer 3 (Mac Fn)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 15; c++) {
      layers[3][r][c] = l1[r][c];
    }
  }

  return layers;
}

export interface ShortcutEntry {
  id: string;
  category: 'Screen' | 'Wireless' | 'Lighting' | 'System';
  keys: string[];
  action: string;
  details: string;
}

export const GMK87_SHORTCUTS: ShortcutEntry[] = [
  // Screen
  {
    id: 'sc-1',
    category: 'Screen',
    keys: ['Fn', 'Right Shift'],
    action: 'Toggle TFT LCD Screen Power On / Off',
    details: 'Turns the 240×135 TFT backlight and controller sleep state on or off to conserve battery in wireless mode.',
  },
  {
    id: 'sc-2',
    category: 'Screen',
    keys: ['Fn', 'Enter'],
    action: 'Cycle Active Screen Mode (Clock → Slot 0 → Slot 1)',
    details: 'Switches cfg[33] between Default Hardware Clock/Telemetry (Mode 0), Custom GIF Slot 0 (Mode 1), and Custom GIF Slot 1 (Mode 2).',
  },
  {
    id: 'sc-3',
    category: 'Screen',
    keys: ['Fn', '▲ / ▼ / ◄ / ►'],
    action: 'Adjust Screen & Underglow Sync Parameters',
    details: 'Navigates on-board screen sub-menus or adjusts brightness/speed depending on active firmware mode.',
  },

  // Wireless
  {
    id: 'sc-4',
    category: 'Wireless',
    keys: ['Fn', 'Q'],
    action: 'Bluetooth Channel 1 (Short Press Switch / Hold 3s Pair)',
    details: 'Switches active wireless host to BT Profile 1. Hold for 3 seconds until key flashes rapidly to enter pairing mode.',
  },
  {
    id: 'sc-5',
    category: 'Wireless',
    keys: ['Fn', 'W'],
    action: 'Bluetooth Channel 2 (Short Press Switch / Hold 3s Pair)',
    details: 'Switches active wireless host to BT Profile 2. Hold for 3 seconds to pair a new laptop, tablet, or phone.',
  },
  {
    id: 'sc-6',
    category: 'Wireless',
    keys: ['Fn', 'E'],
    action: 'Bluetooth Channel 3 (Short Press Switch / Hold 3s Pair)',
    details: 'Switches active wireless host to BT Profile 3. Supports seamless 3-host Bluetooth 5.0 switching.',
  },
  {
    id: 'sc-7',
    category: 'Wireless',
    keys: ['Fn', 'R'],
    action: '2.4GHz Low-Latency Wireless Mode',
    details: 'Connects to the included 1000Hz 2.4GHz USB receiver dongle. Hold 3s to re-pair receiver.',
  },
  {
    id: 'sc-8',
    category: 'Wireless',
    keys: ['Fn', 'T'],
    action: 'USB-C Wired Mode & WebHID Configurator Mode',
    details: 'Switches to USB Type-C wired connection. Required for WebHID frame streaming and VIA keymap programming.',
  },

  // Lighting
  {
    id: 'sc-9',
    category: 'Lighting',
    keys: ['Fn', '\\ |'],
    action: 'Cycle South-Facing RGB Lighting Effect (20 Modes)',
    details: 'Cycles cfg[1] through Wave, Colour Cloud, Vortex, Mix Colour, Breathe, Solid, Starry Night, Meteor, and Matrix Rain.',
  },
  {
    id: 'sc-10',
    category: 'Lighting',
    keys: ['Fn', 'Del'],
    action: 'Cycle Per-Effect RGB Color Preset / Hue',
    details: 'Steps through 8 hardware hue presets (Red, Orange, Yellow, Green, Cyan, Blue, Purple, White/Rainbow).',
  },
  {
    id: 'sc-11',
    category: 'Lighting',
    keys: ['Fn', '▲ / ▼'],
    action: 'Increase / Decrease RGB Backlight Brightness',
    details: 'Adjusts cfg[2] brightness level across 0–9 hardware steps.',
  },
  {
    id: 'sc-12',
    category: 'Lighting',
    keys: ['Fn', '◄ / ►'],
    action: 'Decrease / Increase RGB Animation Speed',
    details: 'Adjusts cfg[3] animation speed across 5 hardware steps.',
  },
  {
    id: 'sc-13',
    category: 'Lighting',
    keys: ['Fn', 'Backspace'],
    action: 'Toggle All RGB LEDs On / Off',
    details: 'Instantly kills or restores per-key and underglow LED power without losing saved effect state.',
  },

  // System
  {
    id: 'sc-14',
    category: 'System',
    keys: ['Fn', 'Win'],
    action: 'Lock / Unlock Windows Key (Gaming Mode)',
    details: 'Prevents accidental Windows Start menu popups during gaming sessions; Win key indicator LED lights up.',
  },
  {
    id: 'sc-15',
    category: 'System',
    keys: ['Fn', 'A'],
    action: 'Switch to Windows OS Layout (Layers 0 & 1)',
    details: 'Sets standard Windows modifier mapping (Win = LGUI, Alt = LALT) and F-row behavior.',
  },
  {
    id: 'sc-16',
    category: 'System',
    keys: ['Fn', 'S'],
    action: 'Switch to macOS Layout (Layers 2 & 3)',
    details: 'Swaps Option and Command modifiers and enables macOS media key defaults.',
  },
  {
    id: 'sc-17',
    category: 'System',
    keys: ['Fn', 'Esc (Hold 5s)'],
    action: 'Factory Reset EEPROM, Keymap & Lighting',
    details: 'Hold for 5 full seconds until RGB flashes red 3 times to restore factory VIA matrix and default config.',
  },
];

export interface PokemonSpriteItem {
  id: number;
  name: string;
  type: string;
  accentColor: string;
  secondaryColor: string;
}

export const CURATED_POKEMON_SPRITES: PokemonSpriteItem[] = [
  { id: 25, name: 'Pikachu', type: 'Electric', accentColor: '#facc15', secondaryColor: '#eab308' },
  { id: 94, name: 'Gengar', type: 'Ghost / Poison', accentColor: '#a855f7', secondaryColor: '#6366f1' },
  { id: 6, name: 'Charizard', type: 'Fire / Flying', accentColor: '#f97316', secondaryColor: '#ef4444' },
  { id: 150, name: 'Mewtwo', type: 'Psychic', accentColor: '#c084fc', secondaryColor: '#ec4899' },
  { id: 133, name: 'Eevee', type: 'Normal', accentColor: '#fbbf24', secondaryColor: '#d97706' },
  { id: 448, name: 'Lucario', type: 'Fighting / Steel', accentColor: '#38bdf8', secondaryColor: '#2563eb' },
  { id: 143, name: 'Snorlax', type: 'Normal', accentColor: '#2dd4bf', secondaryColor: '#0f766e' },
  { id: 384, name: 'Rayquaza', type: 'Dragon / Flying', accentColor: '#10b981', secondaryColor: '#eab308' },
  { id: 197, name: 'Umbreon', type: 'Dark', accentColor: '#facc15', secondaryColor: '#475569' },
  { id: 9, name: 'Blastoise', type: 'Water', accentColor: '#3b82f6', secondaryColor: '#1d4ed8' },
  { id: 778, name: 'Mimikyu', type: 'Ghost / Fairy', accentColor: '#fde047', secondaryColor: '#a855f7' },
  { id: 130, name: 'Gyarados', type: 'Water / Flying', accentColor: '#06b6d4', secondaryColor: '#ef4444' },
  { id: 149, name: 'Dragonite', type: 'Dragon / Flying', accentColor: '#fb923c', secondaryColor: '#14b8a6' },
  { id: 658, name: 'Greninja', type: 'Water / Dark', accentColor: '#38bdf8', secondaryColor: '#ec4899' },
  { id: 1, name: 'Bulbasaur', type: 'Grass / Poison', accentColor: '#4ade80', secondaryColor: '#16a34a' },
  { id: 7, name: 'Squirtle', type: 'Water', accentColor: '#60a5fa', secondaryColor: '#f59e0b' },
  { id: 249, name: 'Lugia', type: 'Psychic / Flying', accentColor: '#38bdf8', secondaryColor: '#e2e8f0' },
  { id: 250, name: 'Ho-Oh', type: 'Fire / Flying', accentColor: '#f59e0b', secondaryColor: '#10b981' },
  { id: 376, name: 'Metagross', type: 'Steel / Psychic', accentColor: '#60a5fa', secondaryColor: '#ef4444' },
  { id: 257, name: 'Blaziken', type: 'Fire / Fighting', accentColor: '#ef4444', secondaryColor: '#facc15' },
  { id: 282, name: 'Gardevoir', type: 'Psychic / Fairy', accentColor: '#4ade80', secondaryColor: '#f472b6' },
  { id: 491, name: 'Darkrai', type: 'Dark', accentColor: '#ef4444', secondaryColor: '#64748b' },
  { id: 212, name: 'Scizor', type: 'Bug / Steel', accentColor: '#ef4444', secondaryColor: '#94a3b8' },
  { id: 248, name: 'Tyranitar', type: 'Rock / Dark', accentColor: '#84cc16', secondaryColor: '#475569' },
  { id: 445, name: 'Garchomp', type: 'Dragon / Ground', accentColor: '#3b82f6', secondaryColor: '#f59e0b' },
  { id: 700, name: 'Sylveon', type: 'Fairy', accentColor: '#f472b6', secondaryColor: '#38bdf8' },
  { id: 151, name: 'Mew', type: 'Psychic', accentColor: '#f9a8d4', secondaryColor: '#38bdf8' },
  { id: 59, name: 'Arcanine', type: 'Fire', accentColor: '#fb923c', secondaryColor: '#fde047' },
  { id: 359, name: 'Absol', type: 'Dark', accentColor: '#e2e8f0', secondaryColor: '#6366f1' },
  { id: 487, name: 'Giratina', type: 'Ghost / Dragon', accentColor: '#ef4444', secondaryColor: '#eab308' },
  { id: 571, name: 'Zoroark', type: 'Dark', accentColor: '#e11d48', secondaryColor: '#334155' },
  { id: 493, name: 'Arceus', type: 'Normal / Mythic', accentColor: '#facc15', secondaryColor: '#ffffff' },
];

export function getPokemonSpriteUrl(id: number, shiny: boolean): string {
  return shiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${id}.gif`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
}
