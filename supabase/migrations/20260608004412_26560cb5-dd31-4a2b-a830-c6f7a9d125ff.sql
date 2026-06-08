-- Self-service role requests (clinician/caregiver only), gated by admin approval
CREATE TABLE public.role_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  requested_role app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.role_requests TO authenticated;
GRANT ALL ON public.role_requests TO service_role;

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users view own role requests"
  ON public.role_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own request
CREATE POLICY "Users create own role request"
  ON public.role_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can see all requests
CREATE POLICY "Admins view all role requests"
  ON public.role_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update requests (the approval fn is definer, but allow direct admin edits too)
CREATE POLICY "Admins update role requests"
  ON public.role_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Validation: only clinician/caregiver may be self-requested; status whitelist
CREATE OR REPLACE FUNCTION public.validate_role_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requested_role NOT IN ('clinician','caregiver') THEN
    RAISE EXCEPTION 'requested_role must be clinician or caregiver';
  END IF;
  IF NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_role_request_trigger
  BEFORE INSERT OR UPDATE ON public.role_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_role_request();

CREATE TRIGGER update_role_requests_updated_at
  BEFORE UPDATE ON public.role_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin-only approval/rejection (grants role server-side)
CREATE OR REPLACE FUNCTION public.review_role_request(p_request_id uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can review role requests' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'decision must be approved or rejected';
  END IF;

  SELECT * INTO v_req FROM public.role_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request already reviewed');
  END IF;

  IF p_decision = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_req.user_id, v_req.requested_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.role_requests
  SET status = p_decision, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Request ' || p_decision);
END;
$$;