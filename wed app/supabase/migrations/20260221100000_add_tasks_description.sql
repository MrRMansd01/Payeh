-- Add optional description to tasks for editable notes in task action modal
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description text;
