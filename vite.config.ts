import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

const serveTemplatePlugin = () => ({
  name: 'serve-template',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const decodedUrl = decodeURIComponent(req.url || '');
      if (decodedUrl === '/模版.xlsx' || decodedUrl.endsWith('/模版.xlsx')) {
        const filePath = path.resolve(__dirname, '模版.xlsx');
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './', // Use relative paths to support GitHub Pages subfolders
    plugins: [react(), tailwindcss(), serveTemplatePlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
