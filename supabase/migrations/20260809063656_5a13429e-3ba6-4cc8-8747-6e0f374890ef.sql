CREATE OR REPLACE FUNCTION private.guard_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.is_director() OR private.is_hr() THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS NOT NULL AND OLD.user_id = auth.uid() THEN
    -- whitelist: only these columns may be self-edited; everything else reverts to OLD
    NEW := OLD
      #= hstore(ARRAY[]::text[], ARRAY[]::text[]);
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
