export interface BrainRegion {
  id: string;
  displayName: string;
  lesionZones: string[];
  functionalDomains: ('motor' | 'speech' | 'visual' | 'cognitive')[];
  exerciseSlugs: string[];
  hemisphere: 'left' | 'right' | 'bilateral' | 'central';
  svgPath?: string;
  position?: { x: number; y: number };
}

export const BRAIN_REGIONS: BrainRegion[] = [
  {
    id: 'left_language',
    displayName: 'Left Language Network',
    lesionZones: ['Broca', 'Wernicke', 'insula', 'arcuate_fasciculus', 'angular_gyrus'],
    functionalDomains: ['speech'],
    exerciseSlugs: ['photo-naming', 'word-practice'],
    hemisphere: 'left',
    position: { x: 250, y: 150 }
  },
  {
    id: 'left_motor',
    displayName: 'Left Motor Areas',
    lesionZones: ['M1', 'premotor', 'internal_capsule', 'corona_radiata'],
    functionalDomains: ['motor'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'left',
    position: { x: 280, y: 100 }
  },
  {
    id: 'right_motor',
    displayName: 'Right Motor Areas',
    lesionZones: ['M1', 'premotor', 'internal_capsule', 'corona_radiata'],
    functionalDomains: ['motor'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'right',
    position: { x: 520, y: 100 }
  },
  {
    id: 'right_visuospatial',
    displayName: 'Right Visuospatial Network',
    lesionZones: ['parietal', 'TPJ', 'dorsal_stream'],
    functionalDomains: ['visual', 'cognitive'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'right',
    position: { x: 550, y: 150 }
  },
  {
    id: 'left_visuospatial',
    displayName: 'Left Parietal Areas',
    lesionZones: ['parietal', 'TPJ'],
    functionalDomains: ['visual', 'cognitive'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'left',
    position: { x: 250, y: 200 }
  },
  {
    id: 'frontal_executive',
    displayName: 'Frontal Executive Areas',
    lesionZones: ['DLPFC', 'ACC', 'frontal'],
    functionalDomains: ['cognitive'],
    exerciseSlugs: ['photo-naming', 'word-practice', 'reach-tap'],
    hemisphere: 'bilateral',
    position: { x: 400, y: 80 }
  },
  {
    id: 'cerebellum',
    displayName: 'Cerebellum',
    lesionZones: ['cerebellum', 'cerebellar'],
    functionalDomains: ['motor'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'bilateral',
    position: { x: 400, y: 280 }
  },
  {
    id: 'subcortical',
    displayName: 'Deep Brain Structures',
    lesionZones: ['basal_ganglia', 'thalamus', 'internal_capsule'],
    functionalDomains: ['motor', 'cognitive'],
    exerciseSlugs: ['reach-tap', 'photo-naming'],
    hemisphere: 'bilateral',
    position: { x: 400, y: 180 }
  }
];

export function getAffectedRegions(lesionZones: string[]): BrainRegion[] {
  return BRAIN_REGIONS.filter(region =>
    region.lesionZones.some(zone =>
      lesionZones.some(lesionZone =>
        zone.toLowerCase().includes(lesionZone.toLowerCase()) ||
        lesionZone.toLowerCase().includes(zone.toLowerCase())
      )
    )
  );
}

export function getRegionsByDomain(domain: 'motor' | 'speech' | 'visual' | 'cognitive'): BrainRegion[] {
  return BRAIN_REGIONS.filter(region => region.functionalDomains.includes(domain));
}
