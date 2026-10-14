export type PhotoNamingTrialMode = 'production' | 'recognition' | 'scaffolded';

/**
 * The visual choice is never evidence of independent spoken retrieval.
 * A choice selected after an attempted spoken answer is assisted practice.
 */
export function resolvePhotoNamingTrialMode(
  inputMode: 'production' | 'recognition',
  productionAttempted: boolean,
): PhotoNamingTrialMode {
  if (inputMode === 'production') return 'production';
  return productionAttempted ? 'scaffolded' : 'recognition';
}
