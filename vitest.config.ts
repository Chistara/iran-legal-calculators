import { defineConfig } from 'vitest/config'

// The engine reads a JavaScript Date by its LOCAL calendar day. Pin the test clock to Tehran so the suite is
// deterministic on any machine and in CI (worker processes inherit this environment).
process.env.TZ = 'Asia/Tehran'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
