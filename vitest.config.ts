import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/Core/**/*.ts', 'src/Utils/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts', 'src/main.ts'],
    },
    projects: [
      {
        name: 'node',
        test: {
          environment: 'node',
          include: [
            'src/Core/**/*.test.ts',
            'src/Utils/**/*.test.ts',
            'src/Store/EventEmitter.test.ts',
            'src/Store/PlayerPalette.test.ts',
            'src/Store/ViewModel.test.ts',
            'src/Store/GameStore.test.ts',
            'src/AI/**/*.test.ts',
            'src/App/InputGate.test.ts',
          ],
        },
      },
      {
        name: 'dom',
        test: {
          environment: 'jsdom',
          include: [
            'src/Render/Animation/**/*.test.ts',
            'src/Render/TerritoryMap.test.ts',
            'src/Audio/**/*.test.ts',
          ],
        },
      },
    ],
  },
});
