
-- Update profile name from Alex M. to Larry N.
UPDATE profiles 
SET profile_name = 'Larry N.',
    clinical_profile = jsonb_build_object(
      'notes', 'Scattered bilateral acute infarcts in different vascular territories (left MCA, right PCA). Embolic shower suspected. Right cerebellar encephalomalacia. Evolving left frontal lobe infarction on follow-up CT. Age-related diffuse cerebral atrophy and chronic microvascular ischemic white matter changes.',
      'severity', jsonb_build_object(
        'speech', 'moderate',
        'overall', 'moderate-severe',
        'comprehension', 'mild',
        'visual', 'mild'
      ),
      'impairments', jsonb_build_object(
        'motor', ARRAY['right_hemiparesis'],
        'speech', ARRAY['anomic_aphasia', 'word_finding_difficulty'],
        'visual', ARRAY['left_visual_field_deficit'],
        'cognitive', ARRAY['reduced_attention_span', 'executive_function_deficit']
      ),
      'last_updated', '2026-03-22',
      'affected_side', 'bilateral',
      'therapy_focus', ARRAY['naming', 'sentence_construction', 'phonological_awareness', 'visual_scanning'],
      'profile_source', 'clinical_note',
      'stroke_location', ARRAY['left_mca', 'right_pca'],
      'stroke_mechanism', 'cardioembolic',
      'extraction_metadata', jsonb_build_object(
        'last_updated', '2026-03-22',
        'source_documents', ARRAY['MRI HEAD W/O CONTRAST 11/4/2025', 'CT HEAD W/O CONTRAST 11/10/2025'],
        'key_findings', ARRAY[
          'Scattered bilateral acute infarcts suspicious for embolic shower',
          'Left MCA territory involvement',
          'Right PCA territory involvement', 
          'Right cerebellar encephalomalacia',
          'Evolving left frontal lobe infarction',
          'Age-related diffuse cerebral atrophy',
          'Chronic microvascular ischemic white matter changes'
        ]
      )
    )
WHERE id = '5bec007d-744f-41a3-a7ad-a17c14e47b41';

-- Also update the active clinical_profile_versions to match
UPDATE clinical_profile_versions
SET profile_data = (SELECT clinical_profile FROM profiles WHERE id = '5bec007d-744f-41a3-a7ad-a17c14e47b41'),
    change_reason = 'Updated to reflect actual clinical imaging findings from MRI and CT reports'
WHERE user_id = '3a2ae857-680d-4ceb-af7c-095ae3036b2d' 
  AND is_active = true;
