ALTER TABLE public.consent_records ALTER COLUMN consent_document_id DROP NOT NULL;

ALTER TABLE public.consent_records DROP CONSTRAINT IF EXISTS consent_records_doc_link_check;
ALTER TABLE public.consent_records
  ADD CONSTRAINT consent_records_doc_link_check
  CHECK (consent_type = 'document_processing' OR consent_document_id IS NOT NULL);