import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite 配置：Chromium 优先，无需兼容 Firefox/Safari
// 关联：项目提示词「平台与兼容性」
export default defineConfig({
  base: process.env.GH_PAGES_BASE ?? '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-core': ['src/Core/GameState.ts'],
          'vendor-card': ['src/Core/Card/CardData.ts'],
          'vendor-ai': ['src/AI/AIDirector.ts'],
          'vendor-ui': ['src/UI/Components/MainMenu.ts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
