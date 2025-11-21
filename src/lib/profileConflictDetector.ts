/**
 * Intelligent Profile Conflict Detection
 * 
 * Compares a newly parsed clinical profile with an existing active profile
 * and identifies conflicts that require human review or decision-making.
 */

export interface ConflictItem {
  field: string;
  category?: string;
  conflictType: 'value_change' | 'addition' | 'removal' | 'multi_territory' | 'severity_change' | 'severity_progression' | 'severity_regression';
  existingValue: any;
  newValue: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  autoMergeable: boolean;
  suggestedResolution?: 'keep_existing' | 'use_new' | 'merge_both' | 'requires_review';
  clinicalSignificance?: string;
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: ConflictItem[];
  safeToAutoMerge: boolean;
  conflictSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendation: 'auto_merge' | 'review_required' | 'manual_resolution_required';
}

/**
 * Main conflict detection function
 */
export function detectProfileConflicts(
  existingProfile: any,
  newProfile: any
): ConflictDetectionResult {
  const conflicts: ConflictItem[] = [];

  // Detect stroke location conflicts
  const locationConflicts = detectStrokeLocationConflicts(
    existingProfile.stroke_location,
    newProfile.stroke_location
  );
  conflicts.push(...locationConflicts);

  // Detect affected side conflicts
  const sideConflicts = detectAffectedSideConflicts(
    existingProfile.affected_side,
    newProfile.affected_side
  );
  conflicts.push(...sideConflicts);

  // Detect impairment conflicts for each category
  const categories = ['motor', 'speech', 'cognitive', 'visual'] as const;
  for (const category of categories) {
    const categoryConflicts = detectImpairmentConflicts(
      category,
      existingProfile.impairments?.[category] || [],
      newProfile.impairments?.[category] || []
    );
    conflicts.push(...categoryConflicts);
  }

  // Calculate conflict summary
  const conflictSummary = {
    critical: conflicts.filter(c => c.severity === 'critical').length,
    high: conflicts.filter(c => c.severity === 'high').length,
    medium: conflicts.filter(c => c.severity === 'medium').length,
    low: conflicts.filter(c => c.severity === 'low').length,
  };

  // Determine if safe to auto-merge
  const safeToAutoMerge = conflicts.every(c => c.autoMergeable) && conflictSummary.critical === 0;

  // Determine recommendation
  let recommendation: ConflictDetectionResult['recommendation'];
  if (conflictSummary.critical > 0) {
    recommendation = 'manual_resolution_required';
  } else if (conflictSummary.high > 0 || !safeToAutoMerge) {
    recommendation = 'review_required';
  } else {
    recommendation = 'auto_merge';
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    safeToAutoMerge,
    conflictSummary,
    recommendation,
  };
}

/**
 * Detect stroke location conflicts
 */
function detectStrokeLocationConflicts(
  existingLocation: string | string[] | null,
  newLocation: string | string[] | null
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  // Normalize to arrays
  const existingArray = normalizeToArray(existingLocation);
  const newArray = normalizeToArray(newLocation);

  // No conflict if both are empty
  if (existingArray.length === 0 && newArray.length === 0) {
    return conflicts;
  }

  // Check if locations are different
  const existingSet = new Set(existingArray);
  const newSet = new Set(newArray);

  const removed = existingArray.filter(loc => !newSet.has(loc));
  const added = newArray.filter(loc => !existingSet.has(loc));

  // Conflict: Completely different location
  if (removed.length > 0 && added.length > 0 && existingArray.length > 0) {
    conflicts.push({
      field: 'stroke_location',
      conflictType: 'value_change',
      existingValue: existingArray,
      newValue: newArray,
      severity: 'critical',
      reasoning: `Stroke location changed from "${formatLocationList(existingArray)}" to "${formatLocationList(newArray)}". This is a critical anatomical discrepancy that requires clinical review.`,
      autoMergeable: false,
      suggestedResolution: 'requires_review',
    });
  }
  // Conflict: Additional territory detected (stroke extension)
  else if (added.length > 0 && removed.length === 0 && existingArray.length > 0) {
    conflicts.push({
      field: 'stroke_location',
      conflictType: 'multi_territory',
      existingValue: existingArray,
      newValue: newArray,
      severity: 'high',
      reasoning: `New imaging shows stroke extension to additional territory: ${formatLocationList(added)}. This suggests stroke progression or multi-territory involvement.`,
      autoMergeable: true,
      suggestedResolution: 'merge_both',
    });
  }
  // Conflict: Territory removed (possible imaging discrepancy)
  else if (removed.length > 0 && added.length === 0) {
    conflicts.push({
      field: 'stroke_location',
      conflictType: 'value_change',
      existingValue: existingArray,
      newValue: newArray,
      severity: 'high',
      reasoning: `Previous imaging indicated ${formatLocationList(removed)}, but new report does not mention this. This may indicate imaging discrepancy or resolution.`,
      autoMergeable: false,
      suggestedResolution: 'requires_review',
    });
  }
  // New location when none existed before
  else if (existingArray.length === 0 && newArray.length > 0) {
    conflicts.push({
      field: 'stroke_location',
      conflictType: 'addition',
      existingValue: null,
      newValue: newArray,
      severity: 'low',
      reasoning: `Initial stroke location identified as ${formatLocationList(newArray)}.`,
      autoMergeable: true,
      suggestedResolution: 'use_new',
    });
  }

  return conflicts;
}

/**
 * Detect affected side conflicts
 */
function detectAffectedSideConflicts(
  existingSide: string | null,
  newSide: string | null
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  // No conflict if both are the same
  if (existingSide === newSide) {
    return conflicts;
  }

  // No conflict if existing is null
  if (!existingSide && newSide) {
    conflicts.push({
      field: 'affected_side',
      conflictType: 'addition',
      existingValue: null,
      newValue: newSide,
      severity: 'low',
      reasoning: `Affected side identified as ${newSide}.`,
      autoMergeable: true,
      suggestedResolution: 'use_new',
    });
    return conflicts;
  }

  // Critical conflict: Different side
  if (existingSide && newSide && existingSide !== newSide) {
    const isBilateralExpansion = (existingSide === 'left' || existingSide === 'right') && newSide === 'bilateral';
    
    if (isBilateralExpansion) {
      conflicts.push({
        field: 'affected_side',
        conflictType: 'value_change',
        existingValue: existingSide,
        newValue: newSide,
        severity: 'high',
        reasoning: `Affected side expanded from ${existingSide} to bilateral involvement. This suggests stroke progression or multi-territory involvement.`,
        autoMergeable: true,
        suggestedResolution: 'use_new',
      });
    } else {
      conflicts.push({
        field: 'affected_side',
        conflictType: 'value_change',
        existingValue: existingSide,
        newValue: newSide,
        severity: 'critical',
        reasoning: `Affected side changed from ${existingSide} to ${newSide}. This is a critical discrepancy requiring clinical review.`,
        autoMergeable: false,
        suggestedResolution: 'requires_review',
      });
    }
  }

  return conflicts;
}

/**
 * Detect impairment conflicts for a specific category
 */
function detectImpairmentConflicts(
  category: 'motor' | 'speech' | 'cognitive' | 'visual',
  existingImpairments: string[],
  newImpairments: string[]
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  const existingSet = new Set(existingImpairments);
  const newSet = new Set(newImpairments);

  const removed = existingImpairments.filter(imp => !newSet.has(imp));
  const added = newImpairments.filter(imp => !existingSet.has(imp));

  // Detect severity changes for overlapping impairments
  const severityConflicts = detectSeverityChanges(category, existingImpairments, newImpairments);
  conflicts.push(...severityConflicts);

  // Conflict: Impairments removed (possible recovery or documentation error)
  if (removed.length > 0) {
    const severity = removed.length > 2 ? 'high' : 'medium';
    conflicts.push({
      field: `impairments.${category}`,
      category,
      conflictType: 'removal',
      existingValue: removed,
      newValue: [],
      severity,
      reasoning: `Previous assessment documented ${formatImpairmentList(removed)}, but new assessment does not mention these. This could indicate recovery, resolution, or documentation discrepancy.`,
      autoMergeable: false,
      suggestedResolution: 'requires_review',
    });
  }

  // Conflict: New impairments added (possible progression or better documentation)
  if (added.length > 0) {
    const isInitialAssessment = existingImpairments.length === 0;
    const severity = isInitialAssessment ? 'low' : (added.length > 2 ? 'high' : 'medium');
    
    conflicts.push({
      field: `impairments.${category}`,
      category,
      conflictType: 'addition',
      existingValue: [],
      newValue: added,
      severity,
      reasoning: isInitialAssessment
        ? `Initial ${category} assessment identified: ${formatImpairmentList(added)}.`
        : `New ${category} impairments detected: ${formatImpairmentList(added)}. This could indicate progression, better documentation, or previously undetected deficits.`,
      autoMergeable: isInitialAssessment,
      suggestedResolution: isInitialAssessment ? 'use_new' : 'merge_both',
    });
  }

  return conflicts;
}

/**
 * Detect severity changes in impairments
 */
function detectSeverityChanges(
  category: 'motor' | 'speech' | 'cognitive' | 'visual',
  existingImpairments: string[],
  newImpairments: string[]
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  // Map impairments by their base type (without severity)
  const existingMap = new Map<string, { full: string; severity: number; type: string }>();
  const newMap = new Map<string, { full: string; severity: number; type: string }>();

  existingImpairments.forEach(imp => {
    const parsed = parseImpairmentSeverity(imp);
    existingMap.set(parsed.baseType, { full: imp, severity: parsed.severity, type: parsed.specificType });
  });

  newImpairments.forEach(imp => {
    const parsed = parseImpairmentSeverity(imp);
    newMap.set(parsed.baseType, { full: imp, severity: parsed.severity, type: parsed.specificType });
  });

  // Check for severity changes in overlapping impairments
  for (const [baseType, existingData] of existingMap.entries()) {
    const newData = newMap.get(baseType);
    
    if (newData) {
      // Check for severity level change
      if (newData.severity !== existingData.severity) {
        const isProgression = newData.severity > existingData.severity;
        const severityChange = Math.abs(newData.severity - existingData.severity);
        
        conflicts.push({
          field: `impairments.${category}`,
          category,
          conflictType: isProgression ? 'severity_progression' : 'severity_regression',
          existingValue: existingData.full,
          newValue: newData.full,
          severity: severityChange >= 2 ? 'critical' : severityChange >= 1 ? 'high' : 'medium',
          reasoning: isProgression
            ? `${formatBaseType(baseType)} severity increased from ${formatImpairment(existingData.full)} to ${formatImpairment(newData.full)}. This indicates clinical progression and requires immediate attention.`
            : `${formatBaseType(baseType)} severity decreased from ${formatImpairment(existingData.full)} to ${formatImpairment(newData.full)}. This suggests improvement or recovery.`,
          autoMergeable: !isProgression, // Auto-merge improvements, review progressions
          suggestedResolution: isProgression ? 'requires_review' : 'use_new',
          clinicalSignificance: isProgression 
            ? 'Worsening condition - may require care plan adjustment'
            : 'Positive recovery trajectory',
        });
      }
      // Check for type change (e.g., expressive → global aphasia)
      else if (newData.type !== existingData.type && newData.type && existingData.type) {
        const typeChange = analyzeTypeChange(baseType, existingData.type, newData.type);
        
        conflicts.push({
          field: `impairments.${category}`,
          category,
          conflictType: 'severity_change',
          existingValue: existingData.full,
          newValue: newData.full,
          severity: typeChange.severity,
          reasoning: typeChange.reasoning,
          autoMergeable: false,
          suggestedResolution: 'requires_review',
          clinicalSignificance: typeChange.clinicalSignificance,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Parse impairment string to extract severity and type information
 */
function parseImpairmentSeverity(impairment: string): {
  baseType: string;
  severity: number;
  specificType: string;
} {
  const lower = impairment.toLowerCase();
  
  // Severity levels (0 = none/unknown, 1 = mild, 2 = moderate, 3 = severe, 4 = global/profound)
  let severity = 0;
  if (lower.includes('mild')) severity = 1;
  else if (lower.includes('moderate')) severity = 2;
  else if (lower.includes('severe')) severity = 3;
  else if (lower.includes('global') || lower.includes('profound') || lower.includes('complete')) severity = 4;
  
  // Extract base type (e.g., "aphasia" from "expressive_aphasia")
  let baseType = impairment;
  let specificType = '';
  
  // Common patterns
  const aphasiaTypes = ['expressive', 'receptive', 'global', 'anomic', 'conduction', 'transcortical', 'broca', 'wernicke'];
  const motorTypes = ['hemiplegia', 'hemiparesis', 'weakness', 'paralysis'];
  const visualTypes = ['hemianopia', 'neglect', 'agnosia'];
  
  if (lower.includes('aphasia')) {
    baseType = 'aphasia';
    const aphasiaType = aphasiaTypes.find(t => lower.includes(t));
    if (aphasiaType) specificType = aphasiaType;
  } else if (motorTypes.some(t => lower.includes(t))) {
    baseType = 'motor_impairment';
    const motorType = motorTypes.find(t => lower.includes(t));
    if (motorType) specificType = motorType;
  } else if (visualTypes.some(t => lower.includes(t))) {
    baseType = 'visual_impairment';
    const visualType = visualTypes.find(t => lower.includes(t));
    if (visualType) specificType = visualType;
  }
  
  return { baseType, severity, specificType };
}

/**
 * Analyze type change for clinical significance
 */
function analyzeTypeChange(
  baseType: string,
  oldType: string,
  newType: string
): {
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  clinicalSignificance: string;
} {
  // Aphasia progression patterns
  if (baseType === 'aphasia') {
    const progressionMap: { [key: string]: number } = {
      'anomic': 1,
      'conduction': 2,
      'transcortical': 2,
      'broca': 3,
      'expressive': 3,
      'wernicke': 3,
      'receptive': 3,
      'global': 4,
    };
    
    const oldSeverity = progressionMap[oldType] || 2;
    const newSeverity = progressionMap[newType] || 2;
    
    if (newSeverity > oldSeverity) {
      return {
        severity: newSeverity === 4 ? 'critical' : 'high',
        reasoning: `Aphasia type changed from ${oldType} to ${newType}, indicating significant progression. ${newType === 'global' ? 'Global aphasia represents the most severe form affecting all language modalities.' : 'This suggests expanding language deficits.'}`,
        clinicalSignificance: 'Requires immediate reassessment of communication strategies and potential care plan modification',
      };
    } else if (newSeverity < oldSeverity) {
      return {
        severity: 'medium',
        reasoning: `Aphasia type changed from ${oldType} to ${newType}, suggesting positive recovery. This indicates improving language function.`,
        clinicalSignificance: 'Positive trajectory - consider advancing therapy goals',
      };
    }
  }
  
  // Motor impairment changes
  if (baseType === 'motor_impairment') {
    const progressionMap: { [key: string]: number } = {
      'weakness': 1,
      'hemiparesis': 2,
      'hemiplegia': 3,
      'paralysis': 3,
    };
    
    const oldSeverity = progressionMap[oldType] || 2;
    const newSeverity = progressionMap[newType] || 2;
    
    if (newSeverity > oldSeverity) {
      return {
        severity: 'high',
        reasoning: `Motor impairment changed from ${oldType} to ${newType}, indicating worsening motor function. This may suggest stroke progression or secondary complications.`,
        clinicalSignificance: 'Urgent medical evaluation recommended',
      };
    } else if (newSeverity < oldSeverity) {
      return {
        severity: 'low',
        reasoning: `Motor impairment improved from ${oldType} to ${newType}, showing positive motor recovery.`,
        clinicalSignificance: 'Excellent progress - continue current therapy approach',
      };
    }
  }
  
  return {
    severity: 'medium',
    reasoning: `Impairment type changed from ${oldType} to ${newType}. Clinical significance requires expert review.`,
    clinicalSignificance: 'Requires clinical interpretation',
  };
}

/**
 * Helper: Format base type for display
 */
function formatBaseType(baseType: string): string {
  return baseType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Helper: Format impairment for display
 */
function formatImpairment(impairment: string): string {
  return impairment.replace(/_/g, ' ');
}

/**
 * Auto-merge profiles when safe to do so
 */
export function autoMergeProfiles(
  existingProfile: any,
  newProfile: any,
  detectionResult: ConflictDetectionResult
): any {
  if (!detectionResult.safeToAutoMerge) {
    throw new Error('Cannot auto-merge: conflicts require manual resolution');
  }

  const merged = JSON.parse(JSON.stringify(existingProfile));

  // Apply auto-mergeable changes
  for (const conflict of detectionResult.conflicts) {
    if (conflict.suggestedResolution === 'use_new') {
      // Replace with new value
      setNestedValue(merged, conflict.field, conflict.newValue);
    } else if (conflict.suggestedResolution === 'merge_both') {
      // Merge arrays (union)
      if (conflict.field.includes('impairments.')) {
        const category = conflict.field.split('.')[1];
        merged.impairments[category] = [
          ...new Set([
            ...(merged.impairments[category] || []),
            ...(Array.isArray(conflict.newValue) ? conflict.newValue : [conflict.newValue])
          ])
        ];
      } else if (conflict.field === 'stroke_location') {
        const existingArray = normalizeToArray(merged.stroke_location);
        const newArray = normalizeToArray(conflict.newValue);
        merged.stroke_location = [...new Set([...existingArray, ...newArray])];
      }
    }
  }

  return merged;
}

/**
 * Helper: Normalize value to array
 */
function normalizeToArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/**
 * Helper: Format location list for display
 */
function formatLocationList(locations: string[]): string {
  return locations.map(loc => loc.replace(/_/g, ' ')).join(', ');
}

/**
 * Helper: Format impairment list for display
 */
function formatImpairmentList(impairments: string[]): string {
  return impairments.map(imp => imp.replace(/_/g, ' ')).join(', ');
}

/**
 * Helper: Set nested object value by path
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * Generate human-readable conflict summary
 */
export function generateConflictSummary(result: ConflictDetectionResult): string {
  if (!result.hasConflicts) {
    return 'No conflicts detected. New information complements existing profile.';
  }

  const parts: string[] = [];

  if (result.conflictSummary.critical > 0) {
    parts.push(`${result.conflictSummary.critical} critical conflict${result.conflictSummary.critical > 1 ? 's' : ''}`);
  }
  if (result.conflictSummary.high > 0) {
    parts.push(`${result.conflictSummary.high} high-priority conflict${result.conflictSummary.high > 1 ? 's' : ''}`);
  }
  if (result.conflictSummary.medium > 0) {
    parts.push(`${result.conflictSummary.medium} medium conflict${result.conflictSummary.medium > 1 ? 's' : ''}`);
  }
  if (result.conflictSummary.low > 0) {
    parts.push(`${result.conflictSummary.low} low-priority conflict${result.conflictSummary.low > 1 ? 's' : ''}`);
  }

  return `Found ${parts.join(', ')}. ${
    result.recommendation === 'manual_resolution_required'
      ? 'Manual resolution required.'
      : result.recommendation === 'review_required'
      ? 'Review recommended before merging.'
      : 'Safe to auto-merge with review.'
  }`;
}
