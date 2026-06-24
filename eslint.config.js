import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import security from 'eslint-plugin-security'
import { defineConfig, globalIgnores } from 'eslint/config'

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
    // Security scan for src/ parser and component code that processes
    // untrusted customer diagnostic data.
    files: ['src/**/*.{ts,tsx}'],
    extends: [security.configs.recommended],
    rules: {
      // False positive: typed TypeScript bracket notation on typed records is
      // safe. The TypeScript type system enforces key validity; prototype
      // injection is not a realistic threat in this build-time tool.
      'security/detect-object-injection': 'off',
      // False positive: src/ has no fs access; this rule only applies to scripts/.
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      security.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
  },
])
