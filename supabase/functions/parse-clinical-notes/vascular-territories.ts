export interface TerritoryMapping {
  location: string;
  keywords: string[];
  side: 'left' | 'right' | 'bilateral' | 'midline';
  
  motor: {
    pattern: string;
    affected_side: 'ipsilateral' | 'contralateral';
    distribution: string;
    confidence: 'high' | 'medium' | 'low';
  };
  
  speech: {
    deficits: string[];
    confidence: 'high' | 'medium' | 'low';
  };
  
  visual: {
    deficits: string[];
    affected_field?: 'ipsilateral' | 'contralateral';
    confidence: 'high' | 'medium' | 'low';
  };
  
  cognitive: {
    deficits: string[];
    confidence: 'high' | 'medium' | 'low';
  };
  
  source_evidence: string;
}

export const VASCULAR_TERRITORIES: Record<string, TerritoryMapping> = {
  'left_mca': {
    location: 'Left Middle Cerebral Artery',
    keywords: ['left mca', 'left middle cerebral', 'left m1', 'left m2', 'left sylvian', 'left frontal', 'left temporal', 'left parietal'],
    side: 'left',
    motor: {
      pattern: 'hemiparesis',
      affected_side: 'contralateral',
      distribution: 'face_arm_greater_than_leg',
      confidence: 'high'
    },
    speech: {
      deficits: ['expressive_aphasia', 'broca_aphasia', 'global_aphasia', 'dysarthria'],
      confidence: 'high'
    },
    visual: {
      deficits: ['homonymous_hemianopia', 'inferior_quadrantanopia'],
      affected_field: 'contralateral',
      confidence: 'high'
    },
    cognitive: {
      deficits: ['ideomotor_apraxia', 'acalculia', 'agraphia'],
      confidence: 'medium'
    },
    source_evidence: 'Left MCA strokes produce contralateral face/arm weakness (>leg) and aphasia in ~95% of cases'
  },
  
  'right_mca': {
    location: 'Right Middle Cerebral Artery',
    keywords: ['right mca', 'right middle cerebral', 'right m1', 'right m2', 'right frontal', 'right temporal', 'right parietal'],
    side: 'right',
    motor: {
      pattern: 'hemiparesis',
      affected_side: 'contralateral',
      distribution: 'face_arm_greater_than_leg',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria', 'dysprosody'],
      confidence: 'high'
    },
    visual: {
      deficits: ['homonymous_hemianopia', 'inferior_quadrantanopia'],
      affected_field: 'contralateral',
      confidence: 'high'
    },
    cognitive: {
      deficits: ['left_hemispatial_neglect', 'anosognosia', 'visuospatial_deficits', 'flat_affect'],
      confidence: 'high'
    },
    source_evidence: 'Right MCA causes left neglect and contralateral weakness WITHOUT aphasia'
  },
  
  'left_aca': {
    location: 'Left Anterior Cerebral Artery',
    keywords: ['left aca', 'left anterior cerebral', 'left a1', 'left a2'],
    side: 'left',
    motor: {
      pattern: 'leg_weakness',
      affected_side: 'contralateral',
      distribution: 'leg_greater_than_arm',
      confidence: 'high'
    },
    speech: {
      deficits: ['transcortical_motor_aphasia', 'abulic_mutism'],
      confidence: 'medium'
    },
    visual: {
      deficits: [],
      confidence: 'high'
    },
    cognitive: {
      deficits: ['abulia', 'apathy', 'executive_dysfunction', 'disinhibition', 'urinary_incontinence'],
      confidence: 'high'
    },
    source_evidence: 'ACA strokes cause leg-predominant weakness (86-90%) with frontal lobe syndrome'
  },
  
  'right_aca': {
    location: 'Right Anterior Cerebral Artery',
    keywords: ['right aca', 'right anterior cerebral', 'right a1', 'right a2'],
    side: 'right',
    motor: {
      pattern: 'leg_weakness',
      affected_side: 'contralateral',
      distribution: 'leg_greater_than_arm',
      confidence: 'high'
    },
    speech: {
      deficits: [],
      confidence: 'high'
    },
    visual: {
      deficits: [],
      confidence: 'high'
    },
    cognitive: {
      deficits: ['abulia', 'apathy', 'executive_dysfunction', 'disinhibition'],
      confidence: 'high'
    },
    source_evidence: 'Right ACA causes left leg weakness with frontal syndrome'
  },
  
  'right_pca': {
    location: 'Right Posterior Cerebral Artery',
    keywords: ['right pca', 'right posterior cerebral', 'right p1', 'right p2', 'right occipital'],
    side: 'right',
    motor: {
      pattern: 'none',
      affected_side: 'contralateral',
      distribution: 'none_unless_peduncle',
      confidence: 'high'
    },
    speech: {
      deficits: [],
      confidence: 'high'
    },
    visual: {
      deficits: ['homonymous_hemianopia', 'field_cut', 'prosopagnosia'],
      affected_field: 'contralateral',
      confidence: 'high'
    },
    cognitive: {
      deficits: ['memory_impairment', 'visuospatial_deficits', 'visual_agnosia'],
      confidence: 'medium'
    },
    source_evidence: 'Right PCA causes left visual field loss (95%) and visuospatial deficits'
  },
  
  'left_pca': {
    location: 'Left Posterior Cerebral Artery',
    keywords: ['left pca', 'left posterior cerebral', 'left p1', 'left p2', 'left occipital'],
    side: 'left',
    motor: {
      pattern: 'none',
      affected_side: 'contralateral',
      distribution: 'none_unless_peduncle',
      confidence: 'high'
    },
    speech: {
      deficits: ['alexia_without_agraphia', 'color_anomia'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['homonymous_hemianopia', 'field_cut'],
      affected_field: 'contralateral',
      confidence: 'high'
    },
    cognitive: {
      deficits: ['memory_impairment', 'reading_difficulty', 'visual_agnosia'],
      confidence: 'medium'
    },
    source_evidence: 'Left PCA causes right visual field cut and alexia without agraphia if splenium involved'
  },
  
  'right_cerebellar': {
    location: 'Right Cerebellum',
    keywords: ['right cerebellar', 'right cerebellum', 'right pica', 'right aica', 'right sca', 'right hemisphere cerebellar'],
    side: 'right',
    motor: {
      pattern: 'ataxia',
      affected_side: 'ipsilateral',
      distribution: 'coordination_not_weakness',
      confidence: 'high'
    },
    speech: {
      deficits: ['ataxic_dysarthria', 'scanning_speech'],
      confidence: 'high'
    },
    visual: {
      deficits: ['nystagmus', 'oscillopsia'],
      confidence: 'high'
    },
    cognitive: {
      deficits: ['cerebellar_cognitive_affective_syndrome', 'executive_dysfunction', 'visuospatial_deficits'],
      confidence: 'low'
    },
    source_evidence: 'Right cerebellar strokes cause IPSILATERAL coordination deficits with ataxic dysarthria'
  },
  
  'left_cerebellar': {
    location: 'Left Cerebellum',
    keywords: ['left cerebellar', 'left cerebellum', 'left pica', 'left aica', 'left sca', 'left hemisphere cerebellar'],
    side: 'left',
    motor: {
      pattern: 'ataxia',
      affected_side: 'ipsilateral',
      distribution: 'coordination_not_weakness',
      confidence: 'high'
    },
    speech: {
      deficits: ['ataxic_dysarthria'],
      confidence: 'high'
    },
    visual: {
      deficits: ['nystagmus', 'oscillopsia'],
      confidence: 'high'
    },
    cognitive: {
      deficits: ['cerebellar_cognitive_affective_syndrome'],
      confidence: 'low'
    },
    source_evidence: 'Left cerebellar strokes cause ipsilateral ataxia'
  },
  
  'left_pons': {
    location: 'Left Pons',
    keywords: ['left pontine', 'left pons', 'left basis pontis', 'left brainstem'],
    side: 'left',
    motor: {
      pattern: 'crossed_hemiparesis',
      affected_side: 'contralateral',
      distribution: 'crossed_brainstem_pattern',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria', 'dysphagia'],
      confidence: 'high'
    },
    visual: {
      deficits: ['diplopia', 'nystagmus', 'lateral_gaze_palsy'],
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Left pontine infarcts cause crossed signs: left facial/eye findings with right body weakness'
  },
  
  'right_pons': {
    location: 'Right Pons',
    keywords: ['right pontine', 'right pons', 'right basis pontis', 'right brainstem'],
    side: 'right',
    motor: {
      pattern: 'crossed_hemiparesis',
      affected_side: 'contralateral',
      distribution: 'crossed_brainstem_pattern',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria', 'dysphagia'],
      confidence: 'high'
    },
    visual: {
      deficits: ['diplopia', 'nystagmus', 'lateral_gaze_palsy'],
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Right pontine infarcts cause crossed signs'
  },
  
  'medulla': {
    location: 'Medulla',
    keywords: ['medullary', 'medulla', 'lateral medullary', 'wallenberg'],
    side: 'midline',
    motor: {
      pattern: 'ataxia',
      affected_side: 'ipsilateral',
      distribution: 'limb_ataxia',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria', 'dysphagia', 'dysphonia'],
      confidence: 'high'
    },
    visual: {
      deficits: ['nystagmus', 'horner_syndrome'],
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Lateral medullary syndrome causes ipsilateral ataxia with dysphagia and Horner syndrome'
  }
};