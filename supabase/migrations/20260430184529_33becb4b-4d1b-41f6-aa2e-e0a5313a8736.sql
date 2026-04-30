
REVOKE EXECUTE ON FUNCTION public.is_study_clinician(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_active_study_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_study_clinician(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_study_enrollment(uuid) TO authenticated;
