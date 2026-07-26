import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Vitest 配置：与 Vite 原生集成，测试就近放置
// 关联：CodeBuddy代码规范 §8.1
// root 使用 fileURLToPath 归一化，修复 Windows 盘符大小写导致
// @vitest/runner 上下文丢失的问题（vitest#5251）
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/Core/**/*.ts', 'src/Utils/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts', 'src/main.ts'],
    },
  },
});
