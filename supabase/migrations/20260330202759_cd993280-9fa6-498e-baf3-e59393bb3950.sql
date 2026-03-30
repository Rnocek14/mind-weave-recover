-- Insert the conversation-turn exercise slug for FK constraint satisfaction
INSERT INTO public.exercises (slug, title, category, metadata)
VALUES (
  'conversation-turn',
  'Conversation Turn',
  'speech',
  '{"event_subtype": true, "discourse_task": true, "description": "Structured telemetry from freeform conversation turns in the Smart Coach"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Also insert conversation-coach and conversation-partner if missing
INSERT INTO public.exercises (slug, title, category, metadata)
VALUES (
  'conversation-coach',
  'Smart Coach',
  'speech',
  '{"discourse_task": true}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.exercises (slug, title, category, metadata)
VALUES (
  'conversation-partner',
  'Free Talk',
  'speech',
  '{"discourse_task": true}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;