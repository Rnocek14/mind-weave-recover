import { DetectedLesion } from './lesion-detector.ts';
import { VASCULAR_TERRITORIES } from './vascular-territories.ts';

export interface InferenceNote {
  impairment: string;
  source: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface InferredProfile {
  impairments: {
    motor: string[];
    speech: string[];
    cognitive: string[];
    visual: string[];
  };
  stroke_location: string[];
  affected_side: string | null;
  therapy_focus: string[];
  confidence: string;
  inference_notes: InferenceNote[];
}

export function inferDeficitsFromLesions(lesions: DetectedLesion[]): InferredProfile {
  const profile: InferredProfile = {
    impairments: {
      motor: [],
      speech: [],
      cognitive: [],
      visual: []
    },
    stroke_location: [],
    affected_side: null,
    therapy_focus: [],
    confidence: 'high',
    inference_notes: []
  };
  
  for (const lesion of lesions) {
    const territory = VASCULAR_TERRITORIES[lesion.territory];
    if (!territory) continue;
    
    // Map motor deficits with sidedness
    if (territory.motor.pattern !== 'none') {
      const affectedSide = territory.motor.affected_side === 'contralateral'
        ? (territory.side === 'left' ? 'right' : territory.side === 'right' ? 'left' : territory.side)
        : territory.side;
      
      const motorImpairment = `${affectedSide}_${territory.motor.pattern}`;
      profile.impairments.motor.push(motorImpairment);
      
      profile.inference_notes.push({
        impairment: motorImpairment,
        source: lesion.source_phrase,
        reasoning: territory.source_evidence,
        confidence: territory.motor.confidence
      });
    }
    
    // Map speech deficits
    for (const speechDeficit of territory.speech.deficits) {
      profile.impairments.speech.push(speechDeficit);
      profile.inference_notes.push({
        impairment: speechDeficit,
        source: lesion.source_phrase,
        reasoning: `${territory.location} typically causes ${speechDeficit.replace(/_/g, ' ')}`,
        confidence: territory.speech.confidence
      });
    }
    
    // Map visual deficits with sidedness
    for (const visualDeficit of territory.visual.deficits) {
      let sideAdjusted = visualDeficit;
      
      // Visual field cuts are contralateral to lesion side
      if (territory.visual.affected_field === 'contralateral') {
        const oppositeSide = territory.side === 'left' ? 'right' : territory.side === 'right' ? 'left' : null;
        if (oppositeSide) {
          sideAdjusted = `${oppositeSide}_${visualDeficit}`;
        }
      }
      
      profile.impairments.visual.push(sideAdjusted);
      profile.inference_notes.push({
        impairment: sideAdjusted,
        source: lesion.source_phrase,
        reasoning: territory.source_evidence,
        confidence: territory.visual.confidence
      });
    }
    
    // Map cognitive deficits
    for (const cognitiveDeficit of territory.cognitive.deficits) {
      profile.impairments.cognitive.push(cognitiveDeficit);
      profile.inference_notes.push({
        impairment: cognitiveDeficit,
        source: lesion.source_phrase,
        reasoning: `${territory.location} involvement suggests ${cognitiveDeficit.replace(/_/g, ' ')}`,
        confidence: territory.cognitive.confidence
      });
    }
    
    // Record stroke location
    profile.stroke_location.push(territory.location);
    
    // Determine primary affected side
    if (territory.motor.pattern !== 'none') {
      const side = territory.motor.affected_side === 'contralateral'
        ? (territory.side === 'left' ? 'right' : territory.side === 'right' ? 'left' : territory.side)
        : territory.side;
      
      if (!profile.affected_side) {
        profile.affected_side = side;
      } else if (profile.affected_side !== side) {
        profile.affected_side = 'bilateral';
      }
    }
  }
  
  // Deduplicate
  profile.impairments.motor = [...new Set(profile.impairments.motor)];
  profile.impairments.speech = [...new Set(profile.impairments.speech)];
  profile.impairments.visual = [...new Set(profile.impairments.visual)];
  profile.impairments.cognitive = [...new Set(profile.impairments.cognitive)];
  
  // Generate therapy focus
  profile.therapy_focus = generateTherapyFocus(profile.impairments);
  
  return profile;
}

function generateTherapyFocus(impairments: any): string[] {
  const focus: string[] = [];
  
  if (impairments.motor.length > 0) {
    focus.push('Improve motor coordination and strength');
  }
  if (impairments.speech.some((s: string) => s.includes('aphasia'))) {
    focus.push('Restore language and communication abilities');
  }
  if (impairments.speech.some((s: string) => s.includes('dysarthria'))) {
    focus.push('Improve speech articulation');
  }
  if (impairments.visual.some((v: string) => v.includes('hemianopia') || v.includes('field'))) {
    focus.push('Compensate for visual field loss through scanning training');
  }
  if (impairments.cognitive.some((c: string) => c.includes('neglect'))) {
    focus.push('Address hemispatial neglect through awareness training');
  }
  if (impairments.cognitive.some((c: string) => c.includes('memory'))) {
    focus.push('Support memory consolidation');
  }
  if (impairments.motor.some((m: string) => m.includes('ataxia'))) {
    focus.push('Address balance and coordination deficits');
  }
  
  return focus;
}
