import { VASCULAR_TERRITORIES, TerritoryMapping } from './vascular-territories.ts';

export interface DetectedLesion {
  territory: string;
  side: 'left' | 'right' | 'bilateral' | 'midline';
  chronicity: 'acute' | 'subacute' | 'chronic';
  source_phrase: string;
  confidence: number;
}

export function detectAllLesions(text: string): DetectedLesion[] {
  const lesions: DetectedLesion[] = [];
  const lowerText = text.toLowerCase();
  
  const acuteMarkers = ['acute', 'new', 'recent', 'current'];
  const chronicMarkers = ['chronic', 'old', 'prior', 'encephalomalacia', 'gliosis', 'previous'];
  
  // Search for each territory
  for (const [territoryKey, territory] of Object.entries(VASCULAR_TERRITORIES)) {
    for (const keyword of territory.keywords) {
      const regex = new RegExp(`([^.!?]*\\b${keyword.replace(/\s+/g, '\\s+')}\\b[^.!?]*)`, 'gi');
      const matches = text.match(regex);
      
      if (matches) {
        for (const match of matches) {
          const matchLower = match.toLowerCase();
          
          // Skip negated findings
          if (matchLower.includes('no ') || matchLower.includes('without ') || 
              matchLower.includes('absence of') || matchLower.includes('negative for')) {
            continue;
          }
          
          // Determine chronicity
          let chronicity: 'acute' | 'subacute' | 'chronic' = 'acute';
          if (chronicMarkers.some(marker => matchLower.includes(marker))) {
            chronicity = 'chronic';
          } else if (matchLower.includes('subacute')) {
            chronicity = 'subacute';
          } else if (acuteMarkers.some(marker => matchLower.includes(marker))) {
            chronicity = 'acute';
          }
          
          lesions.push({
            territory: territoryKey,
            side: territory.side,
            chronicity,
            source_phrase: match.trim(),
            confidence: 0.95
          });
          
          // Only take first match per keyword to avoid duplicates
          break;
        }
      }
    }
  }
  
  return deduplicateLesions(lesions);
}

function deduplicateLesions(lesions: DetectedLesion[]): DetectedLesion[] {
  const seen = new Set<string>();
  const unique: DetectedLesion[] = [];
  
  for (const lesion of lesions) {
    const key = `${lesion.territory}_${lesion.chronicity}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(lesion);
    }
  }
  
  return unique;
}
