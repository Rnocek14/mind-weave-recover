-- Hospital pilot privacy audit #80/#84. Isolated staging verified 2026-10-30.
--
-- Pre-fix reproduced: an unrelated authenticated account read 16 buckets
-- of global cross-patient therapy telemetry via a SECURITY DEFINER RPC.
-- The clinical score/event data behind these counts belong to many patients,
-- not the caller. Ordinary patient accounts must not see global aggregates.
--
-- This migration leaves the original aggregation code intact in the private
-- schema and replaces the public RPC with a checked, admin-only facade.
-- It preserves existing admin dashboards and trusted service-role access.
--
-- Explicit reversible rollback (EMERGENCY ONLY; it would reopen the leak):
--   DROP FUNCTION IF EXISTS public.telemetry_bucketed(text);
--   ALTER FUNCTION private.telemetry_bucketed(text) SET SCHEMA public;
--   GRANT EXECUTE ON FUNCTION public.telemetry_bucketed(text) TO authenticated;
-- Re-run the isolated role matrix afterward; never perform that rollback in
-- production without privacy/security authorization and an incident review.

ALTER FUNCTION public.telemetry_bucketed(text) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.telemetry_bucketed(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.telemetry_bucketed(text)
  TO service_role;

CREATE FUNCTION public.telemetry_bucketed(_window text)
RETURNS TABLE(
  bucket_start timestamptz,
  exercise_slug text,
  total bigint,
  with_error_type bigint,
  with_adaptations bigint,
  with_signal bigint,
  adaptation_event_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized to view clinical telemetry'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT t.bucket_start, t.exercise_slug, t.total, t.with_error_type,
    t.with_adaptations, t.with_signal, t.adaptation_event_count
  FROM private.telemetry_bucketed(_window) AS t;
END;
$function$;

REVOKE ALL ON FUNCTION public.telemetry_bucketed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.telemetry_bucketed(text)
  TO authenticated, service_role;
