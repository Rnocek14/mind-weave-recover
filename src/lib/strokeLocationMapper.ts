/**
 * Stroke Location Normalization Engine
 * 
 * Maps free-text stroke locations to standardized territories,
 * hemispheres, and specific lesion zones for research analytics.
 */

export interface NormalizedStrokeLocation {
  territory: string; // e.g., 'left_mca', 'right_pca', 'bilateral'
  hemisphere: 'left' | 'right' | 'bilateral' | 'unknown';
  lesionZones: string[]; // e.g., ['insula', 'M1', 'Broca']
  confidence: 'high' | 'medium' | 'low';
  rawInput: string;
}

// Territory mapping patterns
const TERRITORY_PATTERNS = {
  // Left hemisphere territories
  left_mca: [
    /left\s+(middle\s+cerebral|mca)/i,
    /mca.*left/i,
    /l\s*mca/i,
  ],
  left_aca: [
    /left\s+(anterior\s+cerebral|aca)/i,
    /aca.*left/i,
    /l\s*aca/i,
  ],
  left_pca: [
    /left\s+(posterior\s+cerebral|pca)/i,
    /pca.*left/i,
    /l\s*pca/i,
  ],
  
  // Right hemisphere territories
  right_mca: [
    /right\s+(middle\s+cerebral|mca)/i,
    /mca.*right/i,
    /r\s*mca/i,
  ],
  right_aca: [
    /right\s+(anterior\s+cerebral|aca)/i,
    /aca.*right/i,
    /r\s*aca/i,
  ],
  right_pca: [
    /right\s+(posterior\s+cerebral|pca)/i,
    /pca.*right/i,
    /r\s*pca/i,
  ],
  
  // Bilateral
  bilateral: [
    /bilateral/i,
    /both\s+hemispheres/i,
    /(left|right).*and.*(right|left)/i,
  ],
  
  // Posterior circulation
  basilar: [
    /basilar/i,
    /vertebrobasilar/i,
  ],
  
  // Subcortical
  subcortical: [
    /subcortical/i,
    /basal\s+ganglia/i,
    /internal\s+capsule/i,
    /thalamus/i,
    /lacunar/i,
  ],
};

// Lesion zone patterns (more specific anatomical areas)
const LESION_ZONE_PATTERNS: Record<string, RegExp[]> = {
  // Motor areas
  'M1': [/primary\s+motor|M1|precentral\s+gyrus/i],
  'premotor': [/premotor|supplementary\s+motor|SMA/i],
  'internal_capsule': [/internal\s+capsule/i],
  
  // Speech/language areas
  'Broca': [/broca|inferior\s+frontal\s+gyrus|IFG/i],
  'Wernicke': [/wernicke|superior\s+temporal\s+gyrus/i],
  'insula': [/insula/i],
  'arcuate_fasciculus': [/arcuate\s+fasciculus/i],
  
  // Parietal
  'parietal': [/parietal\s+lobe|postcentral\s+gyrus|S1/i],
  'angular_gyrus': [/angular\s+gyrus/i],
  'supramarginal_gyrus': [/supramarginal\s+gyrus/i],
  
  // Temporal
  'temporal': [/temporal\s+lobe/i],
  
  // Frontal
  'prefrontal': [/prefrontal|dorsolateral/i],
  'orbitofrontal': [/orbitofrontal/i],
  
  // Occipital
  'occipital': [/occipital/i],
  'V1': [/primary\s+visual|V1|calcarine/i],
  
  // Subcortical
  'basal_ganglia': [/basal\s+ganglia|caudate|putamen|globus\s+pallidus/i],
  'thalamus': [/thalamus/i],
  'brainstem': [/brainstem|pons|medulla/i],
  'cerebellum': [/cerebell/i],
};

// Map vascular territories to the anatomical structures they supply
const TERRITORY_TO_ANATOMY: Record<string, string[]> = {
  'left_mca': ['frontal', 'temporal', 'parietal', 'insula', 'M1', 'premotor', 'Broca', 'Wernicke', 'basal_ganglia', 'internal_capsule'],
  'right_mca': ['frontal', 'temporal', 'parietal', 'insula', 'M1', 'premotor', 'basal_ganglia', 'internal_capsule'],
  'left_aca': ['frontal', 'prefrontal', 'premotor'],
  'right_aca': ['frontal', 'prefrontal', 'premotor'],
  'left_pca': ['occipital', 'V1', 'temporal', 'thalamus'],
  'right_pca': ['occipital', 'V1', 'temporal', 'thalamus'],
  'basilar': ['brainstem', 'pons', 'cerebellum', 'thalamus', 'occipital'],
  'subcortical': ['basal_ganglia', 'thalamus', 'internal_capsule'],
  'left_cerebellar': ['cerebellum'],
  'right_cerebellar': ['cerebellum'],
};

/**
 * Normalize multiple stroke locations (array) into a single merged result
 */
export function normalizeStrokeLocationArray(rawLocations: string[] | string | null | any): NormalizedStrokeLocation {
  // If it's an array, process each location and merge
  if (Array.isArray(rawLocations)) {
    const normalized = rawLocations.map(loc => normalizeStrokeLocation(loc));
    
    // Merge all results
    const allLesionZones = [...new Set(normalized.flatMap(n => n.lesionZones))];
    const territories = normalized.map(n => n.territory).filter(t => t !== 'unknown');
    const hemispheres = normalized.map(n => n.hemisphere).filter(h => h !== 'unknown');
    
    // Determine overall hemisphere
    const hasLeft = hemispheres.includes('left');
    const hasRight = hemispheres.includes('right');
    const overallHemisphere = (hasLeft && hasRight) ? 'bilateral' : 
                              hasLeft ? 'left' : 
                              hasRight ? 'right' : 'unknown';
    
    // Determine confidence (lowest of all)
    const lowestConfidence = normalized.every(n => n.confidence === 'high') ? 'high' :
                             normalized.some(n => n.confidence === 'medium') ? 'medium' : 'low';
    
    return {
      territory: territories.length > 1 ? 'multiple' : territories[0] || 'unknown',
      hemisphere: overallHemisphere,
      lesionZones: allLesionZones,
      confidence: lowestConfidence,
      rawInput: JSON.stringify(rawLocations)
    };
  }
  
  // Fall back to single location processing
  return normalizeStrokeLocation(rawLocations);
}

/**
 * Normalize free-text stroke location into standardized format
 */
export function normalizeStrokeLocation(rawLocation: string | null | any): NormalizedStrokeLocation {
  // Handle non-string values (e.g., if stroke_location is an object)
  let locationString: string | null = null;
  
  if (typeof rawLocation === 'string') {
    locationString = rawLocation;
  } else if (rawLocation && typeof rawLocation === 'object') {
    // If it's an object, try to extract a string value
    locationString = rawLocation.location || rawLocation.strokeLocation || rawLocation.value || JSON.stringify(rawLocation);
  }
  
  if (!locationString || locationString.trim() === '') {
    return {
      territory: 'unknown',
      hemisphere: 'unknown',
      lesionZones: [],
      confidence: 'low',
      rawInput: locationString || '',
    };
  }

  const input = locationString.toLowerCase();
  
  // Match territory
  let territory = 'unknown';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  for (const [territoryName, patterns] of Object.entries(TERRITORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(locationString)) {
        territory = territoryName;
        confidence = 'high';
        break;
      }
    }
    if (confidence === 'high') break;
  }
  
  // Infer hemisphere from territory
  let hemisphere: NormalizedStrokeLocation['hemisphere'] = 'unknown';
  if (territory.startsWith('left_')) {
    hemisphere = 'left';
  } else if (territory.startsWith('right_')) {
    hemisphere = 'right';
  } else if (territory === 'bilateral') {
    hemisphere = 'bilateral';
  } else if (/\bleft\b/i.test(locationString)) {
    hemisphere = 'left';
    if (confidence === 'low') confidence = 'medium';
  } else if (/\bright\b/i.test(locationString)) {
    hemisphere = 'right';
    if (confidence === 'low') confidence = 'medium';
  }
  
  // Extract lesion zones
  const lesionZones: string[] = [];
  for (const [zone, patterns] of Object.entries(LESION_ZONE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(locationString)) {
        lesionZones.push(zone);
        break;
      }
    }
  }
  
  // Add anatomical structures implied by the vascular territory
  if (territory !== 'unknown' && TERRITORY_TO_ANATOMY[territory]) {
    const impliedZones = TERRITORY_TO_ANATOMY[territory];
    // Only add zones that aren't already detected from text
    impliedZones.forEach(zone => {
      if (!lesionZones.includes(zone)) {
        lesionZones.push(zone);
      }
    });
    
    // If we found zones from territory, upgrade confidence
    if (confidence === 'low' && lesionZones.length > 0) {
      confidence = 'medium';
    }
  }
  
  return {
    territory,
    hemisphere,
    lesionZones,
    confidence,
    rawInput: locationString,
  };
}

/**
 * Get user-friendly display name for territory
 */
export function getTerritoryDisplayName(territory: string): string {
  const displayNames: Record<string, string> = {
    left_mca: 'Left MCA',
    left_aca: 'Left ACA',
    left_pca: 'Left PCA',
    right_mca: 'Right MCA',
    right_aca: 'Right ACA',
    right_pca: 'Right PCA',
    bilateral: 'Bilateral',
    basilar: 'Basilar',
    subcortical: 'Subcortical',
    unknown: 'Unknown',
  };
  
  return displayNames[territory] || territory;
}

/**
 * Get user-friendly display name for lesion zone
 */
export function getLesionZoneDisplayName(zone: string): string {
  const displayNames: Record<string, string> = {
    M1: 'Primary Motor (M1)',
    premotor: 'Premotor Cortex',
    internal_capsule: 'Internal Capsule',
    Broca: "Broca's Area",
    Wernicke: "Wernicke's Area",
    insula: 'Insula',
    arcuate_fasciculus: 'Arcuate Fasciculus',
    parietal: 'Parietal Lobe',
    angular_gyrus: 'Angular Gyrus',
    supramarginal_gyrus: 'Supramarginal Gyrus',
    temporal: 'Temporal Lobe',
    prefrontal: 'Prefrontal Cortex',
    orbitofrontal: 'Orbitofrontal Cortex',
    occipital: 'Occipital Lobe',
    V1: 'Primary Visual (V1)',
    basal_ganglia: 'Basal Ganglia',
    thalamus: 'Thalamus',
    brainstem: 'Brainstem',
    cerebellum: 'Cerebellum',
  };
  
  return displayNames[zone] || zone;
}

/**
 * Batch normalize multiple stroke locations (for admin analytics)
 */
export function batchNormalizeLocations(
  locations: Array<{ userId: string; strokeLocation: string | null }>
): Array<{ userId: string; normalized: NormalizedStrokeLocation }> {
  return locations.map(({ userId, strokeLocation }) => ({
    userId,
    normalized: normalizeStrokeLocation(strokeLocation),
  }));
}
