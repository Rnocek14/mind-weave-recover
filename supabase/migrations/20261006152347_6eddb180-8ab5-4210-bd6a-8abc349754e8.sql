INSERT INTO public.clinician_assignments (clinician_id, patient_user_id, profile_id, assigned_by, notes)
SELECT 'cea653c5-99c3-4b61-98bf-e25a0b0d5c96', p.user_id, p.id, 'cea653c5-99c3-4b61-98bf-e25a0b0d5c96', 'Demo caseload for presentation screenshots'
FROM public.profiles p
WHERE p.id IN ('8891a8e6-ca6a-4bfb-88c1-deb85d0d150c','b0f7bc41-a39c-4917-abd7-178c63879fa7','a21a1be3-2565-46dd-823f-e494f67d2a80')
AND NOT EXISTS (SELECT 1 FROM public.clinician_assignments c WHERE c.clinician_id='cea653c5-99c3-4b61-98bf-e25a0b0d5c96' AND c.profile_id=p.id AND c.revoked_at IS NULL);