/**
 * Adaptive Engine Configuration
 * 
 * Controls which adaptations are enabled and their settings.
 * Uses localStorage for feature flags to enable kill-switch behavior.
 */

export interface AdaptiveEngineSettings {
  // Master kill switch
  enabled: boolean;
  
  // Individual adaptation toggles (Phase A safe adaptations)
  adaptations: {
    timeoutMultiplier: boolean;    // Extend timeout for struggling users
    sessionDurationCap: boolean;   // Limit session length for fatigue
    largeTargets: boolean;         // Bigger touch targets for motor issues
    startDifficulty: boolean;      // Start easier for low accuracy
    slowerTTS: boolean;            // Slower text-to-speech
    
    // Phase B (require more data validation first)
    preferredCueType: boolean;     // Personalized cue type selection
    microFluencyDriven: boolean;   // Adaptations based on alignment data
  };
  
  // Clinical thresholds
  thresholds: {
    cueAttributionWindowMs: number;  // Window to attribute success to cue
    stallDetectionMs: number;        // Silence before triggering stall cue
    fatigueDropoffThreshold: number; // Accuracy drop to trigger fatigue adaptation
  };
}

const DEFAULT_SETTINGS: AdaptiveEngineSettings = {
  enabled: false, // Start disabled - clinician enables explicitly
  adaptations: {
    // Phase A - Safe to enable
    timeoutMultiplier: true,
    sessionDurationCap: true,
    largeTargets: true,
    startDifficulty: true,
    slowerTTS: true,
    
    // Phase B - Require validation
    preferredCueType: false,
    microFluencyDriven: false,
  },
  thresholds: {
    cueAttributionWindowMs: 15000, // Extended from 6s to 15s for stroke survivors
    stallDetectionMs: 3000,
    fatigueDropoffThreshold: 0.15, // 15% accuracy drop
  },
};

const STORAGE_KEY = 'adaptive-engine-settings';

/**
 * Get current adaptive engine settings
 */
export function getAdaptiveSettings(): AdaptiveEngineSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(stored);
    // Merge with defaults to handle missing keys from older versions
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      adaptations: {
        ...DEFAULT_SETTINGS.adaptations,
        ...(parsed.adaptations || {}),
      },
      thresholds: {
        ...DEFAULT_SETTINGS.thresholds,
        ...(parsed.thresholds || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update adaptive engine settings
 */
export function setAdaptiveSettings(settings: Partial<AdaptiveEngineSettings>): void {
  if (typeof window === 'undefined') return;
  
  const current = getAdaptiveSettings();
  const updated = {
    ...current,
    ...settings,
    adaptations: {
      ...current.adaptations,
      ...(settings.adaptations || {}),
    },
    thresholds: {
      ...current.thresholds,
      ...(settings.thresholds || {}),
    },
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  console.log('[AdaptiveEngine] Settings updated:', updated);
}

/**
 * Enable the adaptive engine (master switch)
 */
export function enableAdaptiveEngine(): void {
  setAdaptiveSettings({ enabled: true });
}

/**
 * Disable the adaptive engine (kill switch)
 */
export function disableAdaptiveEngine(): void {
  setAdaptiveSettings({ enabled: false });
}

/**
 * Check if a specific adaptation is enabled
 */
export function isAdaptationEnabled(
  adaptation: keyof AdaptiveEngineSettings['adaptations']
): boolean {
  const settings = getAdaptiveSettings();
  return settings.enabled && settings.adaptations[adaptation];
}

/**
 * Get the cue attribution window (extended for stroke survivors)
 */
export function getCueAttributionWindowMs(): number {
  return getAdaptiveSettings().thresholds.cueAttributionWindowMs;
}
