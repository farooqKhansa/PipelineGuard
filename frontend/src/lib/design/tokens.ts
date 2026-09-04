/**
 * Design tokens extracted from the Untitled UI – Pro Figma library.
 * Source: https://www.figma.com/design/vqd5Jli9nCyTELlPd0Vjx9/Untitled-UI---Pro
 *
 * These values are read directly from the Figma variable collections:
 *   "_Primitives"      -> primitive ramps (below)
 *   "1. Color modes"   -> semantic light/dark pairs (globals.css)
 *   "2. Radius"        -> radius scale
 *   "3. Spacing"       -> spacing scale
 *   "6. Typography"    -> type scale
 *
 * Do not hand-edit colour values here. Re-run the extraction against Figma so
 * code and design stay in sync.
 */

/** Primitive colour ramps. Used for data visualisation series, where a
 *  semantic token would be the wrong abstraction (a chart series is not
 *  "error" or "success" — it is a series). */
export const ramp = {
  gray: {
    25: '#fdfdfd', 50: '#fafafa', 100: '#f5f5f5', 200: '#e9eaeb', 300: '#d5d7da',
    400: '#a4a7ae', 500: '#717680', 600: '#535862', 700: '#414651', 800: '#252b37',
    900: '#181d27', 950: '#0a0d12',
  },
  brand: {
    25: '#fcfaff', 50: '#f9f5ff', 100: '#f4ebff', 200: '#e9d7fe', 300: '#d6bbfb',
    400: '#b692f6', 500: '#9e77ed', 600: '#7f56d9', 700: '#6941c6', 800: '#53389e',
    900: '#42307d', 950: '#2c1c5f',
  },
  error: {
    25: '#fffbfa', 50: '#fef3f2', 100: '#fee4e2', 200: '#fecdca', 300: '#fda29b',
    400: '#f97066', 500: '#f04438', 600: '#d92d20', 700: '#b42318', 800: '#912018',
    900: '#7a271a', 950: '#55160c',
  },
  warning: {
    25: '#fffcf5', 50: '#fffaeb', 100: '#fef0c7', 200: '#fedf89', 300: '#fec84b',
    400: '#fdb022', 500: '#f79009', 600: '#dc6803', 700: '#b54708', 800: '#93370d',
    900: '#7a2e0e', 950: '#4e1d09',
  },
  success: {
    25: '#f6fef9', 50: '#ecfdf3', 100: '#dcfae6', 200: '#abefc6', 300: '#75e0a7',
    400: '#47cd89', 500: '#17b26a', 600: '#079455', 700: '#067647', 800: '#085d3a',
    900: '#074d31', 950: '#053321',
  },
  blue: {
    25: '#f5faff', 50: '#eff8ff', 100: '#d1e9ff', 200: '#b2ddff', 300: '#84caff',
    400: '#53b1fd', 500: '#2e90fa', 600: '#1570ef', 700: '#175cd3', 800: '#1849a9',
    900: '#194185', 950: '#102a56',
  },
  blueLight: {
    25: '#f5fbff', 50: '#f0f9ff', 100: '#e0f2fe', 200: '#b9e6fe', 300: '#7cd4fd',
    400: '#36bffa', 500: '#0ba5ec', 600: '#0086c9', 700: '#026aa2', 800: '#065986',
    900: '#0b4a6f', 950: '#062c41',
  },
  cyan: {
    25: '#f5feff', 50: '#ecfdff', 100: '#cff9fe', 200: '#a5f0fc', 300: '#67e3f9',
    400: '#22ccee', 500: '#06aed4', 600: '#088ab2', 700: '#0e7090', 800: '#155b75',
    900: '#164c63', 950: '#0d2d3a',
  },
  indigo: {
    25: '#f5f8ff', 50: '#eef4ff', 100: '#e0eaff', 200: '#c7d7fe', 300: '#a4bcfd',
    400: '#8098f9', 500: '#6172f3', 600: '#444ce7', 700: '#3538cd', 800: '#2d31a6',
    900: '#2d3282', 950: '#1f235b',
  },
  orange: {
    25: '#fefaf5', 50: '#fef6ee', 100: '#fdead7', 200: '#f9dbaf', 300: '#f7b27a',
    400: '#f38744', 500: '#ef6820', 600: '#e04f16', 700: '#b93815', 800: '#932f19',
    900: '#772917', 950: '#511c10',
  },
} as const;

/** Spacing scale — Figma collection "3. Spacing" (px). */
export const spacing = {
  none: 0, xxs: 2, xs: 4, sm: 6, md: 8, lg: 12, xl: 16, '2xl': 20, '3xl': 24,
  '4xl': 32, '5xl': 40, '6xl': 48, '7xl': 64, '8xl': 80, '9xl': 96, '10xl': 128,
  '11xl': 160,
} as const;

/** Radius scale — Figma collection "2. Radius" (px). */
export const radius = {
  none: 0, xxs: 2, xs: 4, sm: 6, md: 8, lg: 10, xl: 12, '2xl': 16, '3xl': 20,
  '4xl': 24, full: 9999,
} as const;

/** Type scale — Figma collection "6. Typography" ([fontSize, lineHeight] px). */
export const typeScale = {
  'text-xs': [12, 18], 'text-sm': [14, 20], 'text-md': [16, 24], 'text-lg': [18, 28],
  'text-xl': [20, 30], 'display-xs': [24, 32], 'display-sm': [30, 38],
  'display-md': [36, 44], 'display-lg': [48, 60], 'display-xl': [60, 72],
  'display-2xl': [72, 90],
} as const;

/** Container/width scale — Figma collections "4. Widths" and "5. Containers". */
export const widths = {
  xxs: 320, xs: 384, sm: 480, md: 560, lg: 640, xl: 768, '2xl': 1024, '3xl': 1280,
  '4xl': 1440, '5xl': 1600, '6xl': 1920, paragraph: 720,
} as const;

/**
 * PRODUCT EXTENSION — not in the base library.
 *
 * PipelineGuard adds one semantic axis the generic library has no concept of:
 * what the agent decided to do. These are derived from library ramps rather
 * than invented, so they stay consistent if the library is re-themed.
 *
 * Deliberate choice: "refused" is NOT given its own hue. A refusal is not an
 * error and not a warning — it is restraint. Colouring it red would read as
 * failure; colouring it green would read as success. It gets neutral ink and a
 * dashed border instead, so it reads as "held back on purpose".
 */
export const decisionPalette = {
  auto_fixed: { light: ramp.success[600], dark: ramp.success[400] },
  flagged:    { light: ramp.warning[600], dark: ramp.warning[400] },
  refused:    { light: ramp.gray[600],    dark: ramp.gray[400]   },
} as const;

/** Chart series colours, in the order they should be assigned. */
export const seriesPalette = {
  light: [ramp.brand[600], ramp.cyan[600], ramp.warning[600], ramp.error[600], ramp.indigo[600], ramp.success[600]],
  dark:  [ramp.brand[400], ramp.cyan[400], ramp.warning[400], ramp.error[400], ramp.indigo[400], ramp.success[400]],
} as const;
