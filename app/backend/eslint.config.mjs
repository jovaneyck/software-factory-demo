import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Backend Architecture Rules
 *
 * 1. Feature slices (dogs, trainings, plans, sessions, health) must not import
 *    from each other — except type-only imports of interfaces/ports.
 *    Only the composition root (createApp.ts) wires concrete implementations.
 *
 * 2. Routes and services must depend on repository interfaces, not on concrete
 *    Fs* implementations.
 *
 * 3. shared/ must not import from any feature slice.
 *
 * 4. Test files get relaxed rules — they may import fakes cross-slice.
 */

const featureSlices = ['dogs', 'trainings', 'plans', 'sessions', 'health'];

// Build cross-slice restriction patterns for a given slice
function crossSlicePatterns(slice) {
  return featureSlices
    .filter((other) => other !== slice)
    .map((other) => ({
      group: [`../${other}/*`],
      message: `Feature slice "${slice}" must not import from "${other}". Dependencies should be injected via createApp.ts.`,
      allowTypeImports: true,
    }));
}

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Global ──────────────────────────────────────────────────────────
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // ── Rule 3: shared/ cannot import from feature slices ───────────────
  {
    files: ['shared/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: featureSlices.map((slice) => ({
            group: [`../${slice}/*`],
            message: `shared/ must not import from feature slice "${slice}".`,
          })),
        },
      ],
    },
  },

  // ── Rule 1: Feature slice isolation ─────────────────────────────────
  // One config per slice so each gets its own set of restricted patterns
  ...featureSlices.map((slice) => ({
    files: [`${slice}/**/*.ts`],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...crossSlicePatterns(slice),
            // No importing the composition root
            {
              group: ['../createApp', '../createApp.js'],
              message:
                'Feature slices must not import the composition root. Dependencies should be injected.',
            },
            // No importing concrete Fs* implementations (even within own slice, for routes/services)
            {
              group: ['./Fs*', '../*/Fs*'],
              message:
                'Only createApp.ts may import concrete Fs* implementations. Depend on interfaces.',
              // Allow type imports so test helpers can reference types
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  })),

  // ── Rule 4: Test files — relaxed, but no Fs* from other slices ──────
  {
    files: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: featureSlices.map((slice) => ({
            group: [`../${slice}/Fs*`],
            message: `Tests should use Fake* implementations, not Fs* from other slices.`,
          })),
        },
      ],
    },
  },

  // ── Ignores ─────────────────────────────────────────────────────────
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs'],
  },
);
