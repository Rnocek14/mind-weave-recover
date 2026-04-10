/**
 * Shadow Mode Feature Flag & Configuration
 * 
 * Controls whether shadow events are written to the database.
 * Default: OFF. Can be enabled via:
 *   1. Environment variable: VITE_SHADOW_MODE_ENABLED=true
 *   2. Per-profile runtime_config: { shadow_mode_enabled: true }
 *   3. Global runtime override (for testing)
 */

let globalOverride: boolean | null = null;

/**
 * Check if Shadow Mode writes are enabled.
 * Priority: globalOverride > env var > profile config > default (false)
 */
export function isShadowModeEnabled(profileRuntimeConfig?: Record<string, any> | null): boolean {
  // 1. Global override (for testing/debugging)
  if (globalOverride !== null) return globalOverride;

  // 2. Environment variable
  if (import.meta.env.VITE_SHADOW_MODE_ENABLED === 'true') return true;

  // 3. Per-profile runtime config
  if (profileRuntimeConfig?.shadow_mode_enabled === true) return true;

  // 4. Default: OFF
  return false;
}

/** Enable/disable Shadow Mode globally at runtime (for dev/testing) */
export function setShadowModeOverride(enabled: boolean | null): void {
  globalOverride = enabled;
  if (import.meta.env.DEV) {
    console.log(`[ShadowMode] Global override set to: ${enabled}`);
  }
}

/** Current model version for provenance tracking */
export const SHADOW_MODEL_VERSION = 'v1.0-classifier-2026Q2';
