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
    id: 'frontal_lobe',
    displayName: 'Frontal Lobe',
    lesionZones: ['frontal', 'DLPFC', 'ACC', 'premotor', 'prefrontal'],
    functionalDomains: ['cognitive', 'motor'],
    exerciseSlugs: ['photo-naming', 'word-practice', 'reach-tap'],
    hemisphere: 'bilateral',
    svgPath: 'M 150,120 Q 180,80 220,100 L 240,180 Q 200,200 160,180 Z',
    position: { x: 190, y: 140 }
  },
  {
    id: 'motor_cortex',
    displayName: 'Motor Areas',
    lesionZones: ['M1', 'premotor', 'SMA', 'motor_cortex'],
    functionalDomains: ['motor'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'bilateral',
    svgPath: 'M 220,100 Q 250,90 280,100 L 280,160 Q 250,170 220,160 Z',
    position: { x: 250, y: 130 }
  },
  {
    id: 'somatosensory_cortex',
    displayName: 'Sensory Areas',
    lesionZones: ['somatosensory', 'postcentral', 'S1'],
    functionalDomains: ['cognitive'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'bilateral',
    svgPath: 'M 280,100 Q 310,95 340,105 L 340,165 Q 310,175 280,165 Z',
    position: { x: 310, y: 135 }
  },
  {
    id: 'parietal_lobe',
    displayName: 'Parietal Lobe',
    lesionZones: ['parietal', 'TPJ', 'superior_parietal', 'angular_gyrus'],
    functionalDomains: ['visual', 'cognitive'],
    exerciseSlugs: ['reach-tap', 'photo-naming'],
    hemisphere: 'bilateral',
    svgPath: 'M 340,105 Q 380,100 420,115 L 410,185 Q 370,190 340,175 Z',
    position: { x: 380, y: 145 }
  },
  {
    id: 'temporal_lobe',
    displayName: 'Temporal Lobe',
    lesionZones: ['temporal', 'superior_temporal', 'middle_temporal'],
    functionalDomains: ['speech', 'cognitive'],
    exerciseSlugs: ['photo-naming', 'word-practice'],
    hemisphere: 'bilateral',
    svgPath: 'M 200,200 Q 240,220 280,210 L 300,260 Q 250,270 210,250 Z',
    position: { x: 250, y: 235 }
  },
  {
    id: 'language_areas',
    displayName: 'Language Network',
    lesionZones: ['Broca', 'Wernicke', 'insula', 'arcuate_fasciculus'],
    functionalDomains: ['speech'],
    exerciseSlugs: ['photo-naming', 'word-practice'],
    hemisphere: 'left',
    svgPath: 'M 160,180 Q 180,200 200,190 L 220,230 Q 190,240 170,220 Z',
    position: { x: 190, y: 210 }
  },
  {
    id: 'occipital_lobe',
    displayName: 'Visual Areas',
    lesionZones: ['occipital', 'V1', 'visual_cortex', 'calcarine'],
    functionalDomains: ['visual'],
    exerciseSlugs: ['reach-tap', 'photo-naming'],
    hemisphere: 'bilateral',
    svgPath: 'M 420,115 Q 460,120 480,140 L 470,200 Q 440,205 410,195 Z',
    position: { x: 445, y: 160 }
  },
  {
    id: 'cerebellum',
    displayName: 'Cerebellum',
    lesionZones: ['cerebellum', 'cerebellar'],
    functionalDomains: ['motor'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'bilateral',
    svgPath: 'M 380,250 Q 420,260 460,250 L 460,290 Q 420,300 380,290 Z',
    position: { x: 420, y: 270 }
  },
  {
    id: 'brainstem',
    displayName: 'Brain Stem',
    lesionZones: ['brainstem', 'medulla', 'pons', 'midbrain'],
    functionalDomains: ['motor', 'cognitive'],
    exerciseSlugs: ['reach-tap'],
    hemisphere: 'central',
    svgPath: 'M 350,280 Q 370,290 390,280 L 390,320 Q 370,330 350,320 Z',
    position: { x: 370, y: 300 }
  },
  {
    id: 'subcortical',
    displayName: 'Deep Brain Structures',
    lesionZones: ['basal_ganglia', 'thalamus', 'internal_capsule', 'corona_radiata'],
    functionalDomains: ['motor', 'cognitive'],
    exerciseSlugs: ['reach-tap', 'photo-naming'],
    hemisphere: 'bilateral',
    svgPath: 'M 280,160 Q 310,170 340,160 L 340,200 Q 310,210 280,200 Z',
    position: { x: 310, y: 180 }
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
