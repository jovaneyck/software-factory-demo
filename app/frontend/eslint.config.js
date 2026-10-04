import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// Design-system guardrail: raw Tailwind palette colors bypass the tokens in tailwind.config.js.
const RAW_PALETTE =
  '\\b(bg|text|border|ring|from|via|to|fill|stroke|divide|outline|accent|shadow|decoration|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)\\b';
const rawPaletteMessage =
  'Use design tokens (brand, ink, canvas, surface, line, success, warning, danger) instead of raw Tailwind palette colors. See src/ui/README.md.';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${RAW_PALETTE}/]`, message: rawPaletteMessage },
        { selector: `TemplateElement[value.raw=/${RAW_PALETTE}/]`, message: rawPaletteMessage },
      ],
    },
  },
]);
