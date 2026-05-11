import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background, var(--bg))',
        foreground: 'var(--color-foreground, var(--ink))',
        popover: 'var(--color-popover, #ffffff)',
        'popover-foreground': 'var(--color-popover-foreground, var(--ink))',
        primary: 'var(--color-primary, var(--accent))',
        'primary-foreground': 'var(--color-primary-foreground, #ffffff)',
        secondary: 'var(--color-secondary, var(--surface-2))',
        'secondary-foreground': 'var(--color-secondary-foreground, var(--ink))',
        muted: 'var(--color-muted, var(--surface-2))',
        'muted-foreground': 'var(--color-muted-foreground, var(--ink-3))',
        accent: 'var(--color-accent, var(--surface-2))',
        'accent-foreground': 'var(--color-accent-foreground, var(--ink))',
        border: 'var(--color-border, var(--line))',
        input: 'var(--color-input, var(--line))',
        ring: 'var(--color-ring, var(--accent))',
        destructive: 'var(--color-destructive, var(--urgent))',
      },
    },
  },
  plugins: [],
};

export default config;
