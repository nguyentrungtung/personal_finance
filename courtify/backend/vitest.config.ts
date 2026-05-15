import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/services/**', 'src/lib/**'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    env: {
      DB_PATH: './data/test.db',
      NODE_ENV: 'test',
      INIT_EMAIL: 'admin@test.com',
      INIT_PASSWORD: 'password',
      JWT_SECRET: 'test-secret-key-for-vitest',
      JWT_EXPIRES_IN: '15m',
    },
    fileParallelism: false,
  },
});
