CREATE TABLE public.biometric_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  serial_number text NOT NULL UNIQUE,
  location text,
  auth_key text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  auto_generate boolean NOT NULL DEFAULT true,
  day_start_time time NOT NULL DEFAULT '00:00',
  last_seen_at timestamptz,
  punches_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.biometric_devices TO authenticated;
GRANT ALL ON public.biometric_devices TO service_role;
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_director_view_devices" ON public.biometric_devices
  FOR SELECT TO authenticated
  USING (private.is_hr() OR private.is_director());

CREATE TABLE public.biometric_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.biometric_devices(id) ON DELETE SET NULL,
  device_serial text,
  device_user_id text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  punched_at timestamptz NOT NULL,
  punch_type text,
  raw text,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX biometric_punches_unique
  ON public.biometric_punches (device_serial, device_user_id, punched_at);
CREATE INDEX biometric_punches_emp_date ON public.biometric_punches (employee_id, punched_at);

GRANT SELECT ON public.biometric_punches TO authenticated;
GRANT ALL ON public.biometric_punches TO service_role;
ALTER TABLE public.biometric_punches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_director_view_punches" ON public.biometric_punches
  FOR SELECT TO authenticated
  USING (private.is_hr() OR private.is_director());

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS device_user_id text;
CREATE INDEX IF NOT EXISTS employees_device_user_id_idx ON public.employees (device_user_id);

CREATE TRIGGER update_biometric_devices_updated_at
  BEFORE UPDATE ON public.biometric_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
