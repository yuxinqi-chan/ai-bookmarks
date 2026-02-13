import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        popup: 'src/popup.ts',
        options: 'src/options.ts',
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
        inlineDynamicImports: false,
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'src/popup.html', dest: '.' },
        { src: 'src/options.html', dest: '.' },
        { src: 'icons/*', dest: 'icons' },
      ],
    }),
  ],
  define: {
    'import.meta.env.WORKER_URL': JSON.stringify(
      process.env.WORKER_URL || 'http://localhost:8787'
    ),
  },
});
