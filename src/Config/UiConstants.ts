export const MOBILE_BREAKPOINT = 768;
export const BOARD_TOTAL_CELLS = 100;
export const BOARD_COLUMNS = 10;
export const BOARD_ROWS = 10;
export const BOARD_CENTER_HOLE = 4;
export const CELL_PADDING = 2;
export const CELL_NUMBER_MIN_SIZE = 30;
export const DICE_ROLL_DURATION = 800;
export const DICE_SETTLE_DELAY = 250;
export const CELL_DISSOLVE_DURATION = 200;
export const CELL_STAGGER_DELAY = 30;
export const COMBO_POP_DURATION = 300;
export const ROBBERY_CLASH_DURATION = 600;
export const COLLAPSE_GLITCH_DURATION = 700;
export const COLLAPSE_SHAKE_DURATION = 500;
export const SETTLE_HOLD_DURATION = 300;
export const MENU_FADE_DURATION = 400;
export const MAX_PARTICLES = 300;
export const COLLAPSE_PARTICLE_COUNT = 120;
export const OCCUPY_PARTICLES_PER_CELL = 6;
export const DICE_TRAIL_PARTICLES = 8;
export const PARTICLE_SIZES = [2, 3, 4] as const;
export const BG_FRAME_INTERVAL = 33;
export const MAIN_FRAME_INTERVAL = 16;
export const SKIP_KEY = 'Space';
export const SKIP_HINT = '按 空格 跳过';

export const PRIMARY_FONT = 'Inter';

export const FONT_STACK = {
  Display: `'Inter', 'DM Sans', 'Space Grotesk', 'Poppins', system-ui, -apple-system, sans-serif`,
  Mono: `'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'IBM Plex Mono', 'Source Code Pro', monospace`,
  Pixel: `'Inter', 'DM Sans', system-ui, -apple-system, sans-serif`,
  Body: `'Inter', 'DM Sans', 'Space Grotesk', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
} as const;
