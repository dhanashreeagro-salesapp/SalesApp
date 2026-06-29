import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {execSync} from 'child_process';

export default defineConfig(() => {
  let commitHash = 'dev-build';
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    console.warn('Could not retrieve git commit hash, using fallback.');
  }

  const buildTime = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __BUILD_TIME__: JSON.stringify(buildTime),
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
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
