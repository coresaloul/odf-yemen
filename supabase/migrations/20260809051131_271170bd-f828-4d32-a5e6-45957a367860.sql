ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_supervisor_id_idx ON public.tasks(supervisor_id);