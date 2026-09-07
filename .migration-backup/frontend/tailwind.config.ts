import type { Config } from 'tailwindcss';

/**
 * Tailwind is configured as a thin mapping over the CSS variables defined in
 * src/app/globals.css, which in turn come from the Untitled UI Pro Figma
 * library. Utility names deliberately match the Figma token names, so
 * `bg-secondary` in code is the same token a designer sees in Figma.
 *
 * Consequence: theming is a CSS-variable swap, not a rebuild. Nothing in the
 * app hardcodes a hex value.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Backgrounds must live under `backgroundColor`, not `colors`. Nesting
      // them in `colors` would emit `bg-bg-primary` and also pollute every
      // other `text-*` / `border-*` namespace with background tokens.
      backgroundColor: {
        primary: 'var(--bg-primary)',
        'primary-alt': 'var(--bg-primary-alt)',
        'primary-hover': 'var(--bg-primary-hover)',
        'primary-solid': 'var(--bg-primary-solid)',
        secondary: 'var(--bg-secondary)',
        'secondary-alt': 'var(--bg-secondary-alt)',
        'secondary-hover': 'var(--bg-secondary-hover)',
        'secondary-subtle': 'var(--bg-secondary-subtle)',
        'secondary-solid': 'var(--bg-secondary-solid)',
        tertiary: 'var(--bg-tertiary)',
        quaternary: 'var(--bg-quaternary)',
        active: 'var(--bg-active)',
        disabled: 'var(--bg-disabled)',
        overlay: 'var(--bg-overlay)',
        'brand-primary': 'var(--bg-brand-primary)',
        // Subtle brand surface. In dark mode the library maps this to a near-black
        // panel rather than a tint, because a saturated purple ground cannot
        // carry secondary text. Use this, not bg-brand-primary, for panels.
        'brand-primary-alt': 'var(--bg-brand-primary-alt)',
        'brand-secondary': 'var(--bg-brand-secondary)',
        'brand-solid': 'var(--bg-brand-solid)',
        'brand-solid-hover': 'var(--bg-brand-solid-hover)',
        'error-primary': 'var(--bg-error-primary)',
        'error-secondary': 'var(--bg-error-secondary)',
        'error-solid': 'var(--bg-error-solid)',
        'warning-primary': 'var(--bg-warning-primary)',
        'warning-secondary': 'var(--bg-warning-secondary)',
        'warning-solid': 'var(--bg-warning-solid)',
        'success-primary': 'var(--bg-success-primary)',
        'success-secondary': 'var(--bg-success-secondary)',
        'success-solid': 'var(--bg-success-solid)',
        // Product extension - agent decision axis
        'decision-autofix-bg': 'var(--decision-autofix-bg)',
        'decision-flag-bg': 'var(--decision-flag-bg)',
        'decision-refuse-bg': 'var(--decision-refuse-bg)',
      },
      colors: {
        fg: {
          primary: 'var(--fg-primary)',
          secondary: 'var(--fg-secondary)',
          tertiary: 'var(--fg-tertiary)',
          quaternary: 'var(--fg-quaternary)',
          white: 'var(--fg-white)',
          disabled: 'var(--fg-disabled)',
          'brand-primary': 'var(--fg-brand-primary)',
          'brand-secondary': 'var(--fg-brand-secondary)',
          'error-primary': 'var(--fg-error-primary)',
          'error-secondary': 'var(--fg-error-secondary)',
          'warning-primary': 'var(--fg-warning-primary)',
          'warning-secondary': 'var(--fg-warning-secondary)',
          'success-primary': 'var(--fg-success-primary)',
          'success-secondary': 'var(--fg-success-secondary)',
        },
        decision: {
          autofix: 'var(--decision-autofix)',
          'autofix-bg': 'var(--decision-autofix-bg)',
          flag: 'var(--decision-flag)',
          'flag-bg': 'var(--decision-flag-bg)',
          refuse: 'var(--decision-refuse)',
          'refuse-bg': 'var(--decision-refuse-bg)',
        },
        sev: {
          critical: 'var(--sev-critical)',
          high: 'var(--sev-high)',
          medium: 'var(--sev-medium)',
          low: 'var(--sev-low)',
        },
      },
      textColor: {
        primary: 'var(--text-primary)',
        'primary-on-brand': 'var(--text-primary-on-brand)',
        secondary: 'var(--text-secondary)',
        'secondary-hover': 'var(--text-secondary-hover)',
        tertiary: 'var(--text-tertiary)',
        quaternary: 'var(--text-quaternary)',
        white: 'var(--text-white)',
        disabled: 'var(--text-disabled)',
        placeholder: 'var(--text-placeholder)',
        'brand-primary': 'var(--text-brand-primary)',
        'brand-secondary': 'var(--text-brand-secondary)',
        'brand-tertiary': 'var(--text-brand-tertiary)',
        'error-primary': 'var(--text-error-primary)',
        'warning-primary': 'var(--text-warning-primary)',
        'success-primary': 'var(--text-success-primary)',
      },
      borderColor: {
        primary: 'var(--border-primary)',
        secondary: 'var(--border-secondary)',
        tertiary: 'var(--border-tertiary)',
        disabled: 'var(--border-disabled)',
        brand: 'var(--border-brand)',
        error: 'var(--border-error)',
        'error-subtle': 'var(--border-error-subtle)',
      },
      // Figma collection "3. Spacing"
      spacing: {
        none: '0px', xxs: '2px', xs: '4px', sm: '6px', md: '8px', lg: '12px',
        xl: '16px', '2xl': '20px', '3xl': '24px', '4xl': '32px', '5xl': '40px',
        '6xl': '48px', '7xl': '64px', '8xl': '80px', '9xl': '96px',
        '10xl': '128px', '11xl': '160px',
      },
      // Figma collection "2. Radius"
      borderRadius: {
        none: '0px', xxs: '2px', xs: '4px', sm: '6px', md: '8px', lg: '10px',
        xl: '12px', '2xl': '16px', '3xl': '20px', '4xl': '24px', full: '9999px',
      },
      // Figma collection "6. Typography"
      fontSize: {
        'text-xs': ['12px', { lineHeight: '18px' }],
        'text-sm': ['14px', { lineHeight: '20px' }],
        'text-md': ['16px', { lineHeight: '24px' }],
        'text-lg': ['18px', { lineHeight: '28px' }],
        'text-xl': ['20px', { lineHeight: '30px' }],
        'display-xs': ['24px', { lineHeight: '32px' }],
        'display-sm': ['30px', { lineHeight: '38px' }],
        'display-md': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
        'display-lg': ['48px', { lineHeight: '60px', letterSpacing: '-0.02em' }],
        'display-xl': ['60px', { lineHeight: '72px', letterSpacing: '-0.02em' }],
        'display-2xl': ['72px', { lineHeight: '90px', letterSpacing: '-0.02em' }],
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Figma collection "4. Widths"
      maxWidth: {
        xxs: '320px', xs: '384px', sm: '480px', md: '560px', lg: '640px',
        xl: '768px', '2xl': '1024px', '3xl': '1280px', '4xl': '1440px',
        '5xl': '1600px', '6xl': '1920px', paragraph: '720px',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
