import { createRequire } from 'node:module'
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

// TypeScript 7 (the native compiler) has no JavaScript API any more, but typescript-eslint still parses through the
// classic one: point its "typescript" import at the TypeScript 6 package that is installed next to it for exactly that.
const nodeRequire = createRequire(import.meta.url)
const Module = nodeRequire('node:module') as { _resolveFilename: (request: string, ...rest: unknown[]) => string }
const resolveFilename = Module._resolveFilename
Module._resolveFilename = (request, ...rest) => resolveFilename(request === 'typescript' ? 'typescript6' : request, ...rest)
// Loaded through Node's own require (not the config loader's), so the redirect above applies to it.
const tseslint = nodeRequire('typescript-eslint') as typeof import('typescript-eslint')

export default defineConfig(
  globalIgnores(['dist', 'node_modules', 'test-results', 'playwright-report']),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // The app has its own dialogs; the browser's boxes are never used.
      'no-alert': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
