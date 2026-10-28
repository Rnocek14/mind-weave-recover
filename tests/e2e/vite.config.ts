import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import appConfig from '../../vite.config';
import {
  PRODUCTION_PROJECT_REF,
  resolveE2EEnvironment,
  rewriteGeneratedSupabaseClient,
} from '../../scripts/e2e-environment.mjs';

const settings = resolveE2EEnvironment();
const clientPath = fileURLToPath(new URL('../../src/integrations/supabase/client.ts', import.meta.url));

export default defineConfig(async (env) => mergeConfig(
  typeof appConfig === 'function' ? await appConfig(env) : appConfig,
  {
    // Override tracked .env defaults for every other API consumer too.
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(settings.supabaseURL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(settings.publishableKey),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(settings.projectRef),
    },
    plugins: [{
      name: 'isolated-e2e-backend',
      enforce: 'pre',
      transform(source, id) {
        if (id.split('?')[0] !== clientPath) return null;
        return { code: rewriteGeneratedSupabaseClient(source, settings), map: null };
      },
      generateBundle(_options, bundle) {
        for (const [name, output] of Object.entries(bundle)) {
          const text = output.type === 'chunk' ? output.code : String(output.source);
          if (text.includes(PRODUCTION_PROJECT_REF)) {
            this.error(`E2E bundle ${name} still contains the production backend. Refusing to start tests.`);
          }
        }
      },
    } satisfies Plugin],
  },
));
