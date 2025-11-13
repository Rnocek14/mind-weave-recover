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
  },
  
  // ========== SUBCORTICAL TERRITORIES ==========
  
  'left_thalamus': {
    location: 'Left Thalamus',
    keywords: ['left thalamus', 'left thalamic', 'left PCA perforator'],
    side: 'left',
    motor: {
      pattern: 'minimal_weakness',
      affected_side: 'contralateral',
      distribution: 'mild_if_present',
      confidence: 'low'
    },
    speech: {
      deficits: ['possible_aphasia', 'reduced_fluency'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['minor_deficit_if_lgn'],
      confidence: 'low'
    },
    cognitive: {
      deficits: ['memory_impairment', 'executive_dysfunction'],
      confidence: 'medium'
    },
    source_evidence: 'Pure sensory stroke with right hemisensory loss; possible aphasia if dominant thalamus'
  },
  
  'right_thalamus': {
    location: 'Right Thalamus',
    keywords: ['right thalamus', 'right thalamic', 'right PCA perforator'],
    side: 'right',
    motor: {
      pattern: 'minimal_weakness',
      affected_side: 'contralateral',
      distribution: 'mild_if_present',
      confidence: 'low'
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
      deficits: ['visuospatial_neglect', 'inattention'],
      confidence: 'low'
    },
    source_evidence: 'Pure sensory stroke with left hemisensory loss'
  },
  
  'bilateral_thalami': {
    location: 'Bilateral Thalami',
    keywords: ['bilateral thalamic', 'artery of percheron', 'paramedian thalamus'],
    side: 'bilateral',
    motor: {
      pattern: 'minimal_weakness',
      affected_side: 'contralateral',
      distribution: 'pyramidal_tracts_spared',
      confidence: 'low'
    },
    speech: {
      deficits: ['reduced_output', 'akinetic_mutism'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['vertical_gaze_palsy', 'upward_downward_paralysis'],
      confidence: 'medium'
    },
    cognitive: {
      deficits: ['impaired_consciousness', 'severe_memory_deficit', 'confusion'],
      confidence: 'high'
    },
    source_evidence: 'Artery of Percheron syndrome with impaired arousal and severe memory loss'
  },
  
  'left_internal_capsule': {
    location: 'Left Internal Capsule',
    keywords: ['left internal capsule', 'left posterior limb', 'left capsular lacune'],
    side: 'left',
    motor: {
      pattern: 'pure_motor_hemiparesis',
      affected_side: 'contralateral',
      distribution: 'face_arm_leg_equal',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['possible_hemianopia_if_optic_radiation'],
      confidence: 'low'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Pure motor lacunar stroke with right face-arm-leg hemiparesis equally'
  },
  
  'right_internal_capsule': {
    location: 'Right Internal Capsule',
    keywords: ['right internal capsule', 'right posterior limb', 'right capsular lacune'],
    side: 'right',
    motor: {
      pattern: 'pure_motor_hemiparesis',
      affected_side: 'contralateral',
      distribution: 'face_arm_leg_equal',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['possible_hemianopia_if_optic_radiation'],
      confidence: 'low'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Pure motor lacunar stroke with left face-arm-leg hemiparesis'
  },
  
  'left_basal_ganglia': {
    location: 'Left Basal Ganglia',
    keywords: ['left basal ganglia', 'left putamen', 'left lentiform', 'left lenticulostriate'],
    side: 'left',
    motor: {
      pattern: 'hemiparesis',
      affected_side: 'contralateral',
      distribution: 'face_arm_leg_equal',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['possible_hemianopia_if_deep'],
      confidence: 'low'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Subcortical stroke without cortical signs'
  },
  
  'right_basal_ganglia': {
    location: 'Right Basal Ganglia',
    keywords: ['right basal ganglia', 'right putamen', 'right lentiform', 'right lenticulostriate'],
    side: 'right',
    motor: {
      pattern: 'hemiparesis',
      affected_side: 'contralateral',
      distribution: 'face_arm_leg_equal',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'medium'
    },
    visual: {
      deficits: [],
      confidence: 'high'
    },
    cognitive: {
      deficits: ['left_spatial_neglect', 'inattention'],
      confidence: 'low'
    },
    source_evidence: 'Subcortical lacunar stroke'
  },
  
  'left_caudate': {
    location: 'Left Caudate Nucleus',
    keywords: ['left caudate', 'left caudate head', 'left caudate nucleus'],
    side: 'left',
    motor: {
      pattern: 'mild_weakness',
      affected_side: 'contralateral',
      distribution: 'arm_face_if_present',
      confidence: 'low'
    },
    speech: {
      deficits: ['aphasia', 'reduced_spontaneous_speech', 'transcortical_motor_aphasia'],
      confidence: 'medium'
    },
    visual: {
      deficits: [],
      confidence: 'high'
    },
    cognitive: {
      deficits: ['abulia', 'apathy', 'executive_dysfunction'],
      confidence: 'high'
    },
    source_evidence: 'Dominant subcortical frontal syndrome with marked abulia'
  },
  
  'right_caudate': {
    location: 'Right Caudate Nucleus',
    keywords: ['right caudate', 'right caudate head', 'right caudate nucleus'],
    side: 'right',
    motor: {
      pattern: 'mild_weakness',
      affected_side: 'contralateral',
      distribution: 'arm_face_if_present',
      confidence: 'low'
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
      deficits: ['abulia', 'apathy', 'visuospatial_neglect', 'inattention'],
      confidence: 'high'
    },
    source_evidence: 'Non-dominant subcortical frontal syndrome'
  },
  
  'left_subthalamic': {
    location: 'Left Subthalamic Nucleus',
    keywords: ['left subthalamic', 'left STN'],
    side: 'left',
    motor: {
      pattern: 'hemiballismus',
      affected_side: 'contralateral',
      distribution: 'involuntary_movements',
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
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Right hemiballismus (involuntary flinging movements) without weakness'
  },
  
  'right_subthalamic': {
    location: 'Right Subthalamic Nucleus',
    keywords: ['right subthalamic', 'right STN'],
    side: 'right',
    motor: {
      pattern: 'hemiballismus',
      affected_side: 'contralateral',
      distribution: 'involuntary_movements',
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
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Left hemiballismus (movement disorder) without weakness'
  },
  
  // ========== BRAINSTEM TERRITORIES ==========
  
  'left_midbrain': {
    location: 'Left Midbrain',
    keywords: ['left midbrain', 'left cerebral peduncle', 'weber syndrome left', 'weber left'],
    side: 'left',
    motor: {
      pattern: 'hemiparesis',
      affected_side: 'contralateral',
      distribution: 'face_arm_leg',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'low'
    },
    visual: {
      deficits: ['cn3_palsy', 'ptosis', 'dilated_pupil', 'diplopia'],
      affected_field: 'ipsilateral',
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Weber syndrome: left CN III palsy with right hemiplegia'
  },
  
  'right_midbrain': {
    location: 'Right Midbrain',
    keywords: ['right midbrain', 'right cerebral peduncle', 'weber syndrome right', 'weber right'],
    side: 'right',
    motor: {
      pattern: 'hemiparesis',
      affected_side: 'contralateral',
      distribution: 'face_arm_leg',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'low'
    },
    visual: {
      deficits: ['cn3_palsy', 'ptosis', 'dilated_pupil', 'diplopia'],
      affected_field: 'ipsilateral',
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Weber syndrome: right CN III palsy with left hemiplegia'
  },
  
  'left_medial_pons': {
    location: 'Left Medial Pons',
    keywords: ['left medial pons', 'left paramedian pons', 'millard gubler left', 'foville left'],
    side: 'left',
    motor: {
      pattern: 'hemiparesis',
      affected_side: 'contralateral',
      distribution: 'arm_leg',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['diplopia', 'cn6_palsy', 'lateral_gaze_palsy'],
      affected_field: 'ipsilateral',
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Millard-Gubler syndrome: left CN VI/VII palsy with right hemiplegia'
  },
  
  'right_medial_pons': {
    location: 'Right Medial Pons',
    keywords: ['right medial pons', 'right paramedian pons', 'millard gubler right', 'foville right'],
    side: 'right',
    motor: {
      pattern: 'hemiparesis',
      affected_side: 'contralateral',
      distribution: 'arm_leg',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['diplopia', 'cn6_palsy', 'lateral_gaze_palsy'],
      affected_field: 'ipsilateral',
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Millard-Gubler syndrome: right CN VI/VII palsy with left hemiplegia'
  },
  
  'left_lateral_pons': {
    location: 'Left Lateral Pons',
    keywords: ['left lateral pons', 'left AICA', 'left dorsolateral pons'],
    side: 'left',
    motor: {
      pattern: 'ataxia',
      affected_side: 'ipsilateral',
      distribution: 'limb_ataxia',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['nystagmus', 'diplopia', 'cn6_involvement'],
      confidence: 'medium'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'AICA syndrome: vertigo, ataxia, ipsilateral CN VII/VIII deficits, crossed sensory loss'
  },
  
  'right_lateral_pons': {
    location: 'Right Lateral Pons',
    keywords: ['right lateral pons', 'right AICA', 'right dorsolateral pons'],
    side: 'right',
    motor: {
      pattern: 'ataxia',
      affected_side: 'ipsilateral',
      distribution: 'limb_ataxia',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria'],
      confidence: 'medium'
    },
    visual: {
      deficits: ['nystagmus', 'diplopia', 'lateral_gaze_palsy'],
      confidence: 'medium'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'AICA syndrome: crossed sensory loss with ipsilateral CN VII/VIII'
  },
  
  'left_medial_medulla': {
    location: 'Left Medial Medulla',
    keywords: ['left medial medulla', 'left anterior medulla', 'dejerine left'],
    side: 'left',
    motor: {
      pattern: 'hemiplegia',
      affected_side: 'contralateral',
      distribution: 'arm_leg',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria', 'tongue_weakness'],
      confidence: 'medium'
    },
    visual: {
      deficits: [],
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Dejerine syndrome: left CN XII palsy (tongue deviates left) with right hemiplegia'
  },
  
  'right_medial_medulla': {
    location: 'Right Medial Medulla',
    keywords: ['right medial medulla', 'right anterior medulla', 'dejerine right'],
    side: 'right',
    motor: {
      pattern: 'hemiplegia',
      affected_side: 'contralateral',
      distribution: 'arm_leg',
      confidence: 'high'
    },
    speech: {
      deficits: ['dysarthria', 'tongue_weakness'],
      confidence: 'medium'
    },
    visual: {
      deficits: [],
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Medial medullary syndrome: right CN XII palsy with left hemiplegia'
  },
  
  // ========== SPECIAL SYNDROMES ==========
  
  'locked_in': {
    location: 'Locked-In Syndrome',
    keywords: ['locked in', 'locked-in', 'bilateral ventral pons', 'pontine basilar'],
    side: 'bilateral',
    motor: {
      pattern: 'quadriplegia',
      affected_side: 'contralateral',
      distribution: 'complete_paralysis',
      confidence: 'high'
    },
    speech: {
      deficits: ['anarthria', 'complete_loss_speech'],
      confidence: 'high'
    },
    visual: {
      deficits: ['horizontal_gaze_palsy', 'vertical_movements_preserved'],
      confidence: 'high'
    },
    cognitive: {
      deficits: [],
      confidence: 'high'
    },
    source_evidence: 'Bilateral ventral pontine: quadriplegia with preserved awareness and vertical eye movement'
  },
  
  'bilateral_aca': {
    location: 'Bilateral ACA',
    keywords: ['bilateral aca', 'bilateral anterior cerebral', 'bihemispheric aca'],
    side: 'bilateral',
    motor: {
      pattern: 'paraplegia',
      affected_side: 'contralateral',
      distribution: 'both_lower_extremities',
      confidence: 'high'
    },
    speech: {
      deficits: ['akinetic_mutism', 'sparse_speech'],
      confidence: 'high'
    },
    visual: {
      deficits: [],
      confidence: 'high'
    },
    cognitive: {
      deficits: ['severe_abulia', 'apathy', 'frontal_executive_dysfunction'],
      confidence: 'high'
    },
    source_evidence: 'Bilateral ACA syndrome: frontal lobe syndrome with paraplegia and abulia'
  },
  
  'watershed': {
    location: 'Watershed Infarcts',
    keywords: ['watershed', 'borderzone', 'man in the barrel', 'border zone'],
    side: 'bilateral',
    motor: {
      pattern: 'proximal_weakness',
      affected_side: 'contralateral',
      distribution: 'brachial_diplegia',
      confidence: 'medium'
    },
    speech: {
      deficits: ['hypophonia'],
      confidence: 'low'
    },
    visual: {
      deficits: [],
      confidence: 'high'
    },
    cognitive: {
      deficits: ['mild_cognitive_impairment'],
      confidence: 'low'
    },
    source_evidence: 'Man-in-the-barrel syndrome: proximal arm weakness from bilateral border-zone infarcts'
  }
};