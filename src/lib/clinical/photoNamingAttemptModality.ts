export type PhotoNamingTrialMode = 'production' | 'recognition' | 'scaffolded';

/** A visible choice can never be evidence of independent spoken retrieval. */
export function resolvePhotoNamingTrialMode(
  inputMode: 'production' | 'recognition',
  productionAttempted: boolean,
): PhotoNamingTrialMode {
  if (inputMode === 'production') return 'production';
  return productionAttempted ? 'scaffolded' : 'recognition';
}
