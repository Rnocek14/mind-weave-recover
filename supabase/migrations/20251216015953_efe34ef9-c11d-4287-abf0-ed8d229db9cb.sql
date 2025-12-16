-- Allow admins to update utterance_analyses for clinical review
CREATE POLICY "Admins can update utterance analyses for review" 
ON public.utterance_analyses 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));