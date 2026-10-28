import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import isolatedConfig from '../vite.config';

// Reuse the exact production-client rewrite and final bundle production scan.
// Only the HTML entry changes; the imported app hooks/components are real.
export default defineConfig(async (env) => mergeConfig(
  typeof isolatedConfig === 'function' ? await isolatedConfig(env) : isolatedConfig,
  {
    root: fileURLToPath(new URL('./harness', import.meta.url)),
    publicDir: fileURLToPath(new URL('../../../public', import.meta.url)),
    build: {
      outDir: fileURLToPath(new URL('../../../dist-e2e-speech', import.meta.url)),
      emptyOutDir: true,
    },
  },
));
