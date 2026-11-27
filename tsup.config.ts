import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'es2020',
  platform: 'neutral',
  treeshake: true,
  // jalaali-js stays a runtime dependency — never bundled.
  external: ['jalaali-js'],
})
