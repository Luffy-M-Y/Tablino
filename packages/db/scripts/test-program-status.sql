BEGIN;

DO $$
BEGIN
  PERFORM 'invalid'::status;
  RAISE EXCEPTION 'Expected an invalid program status to be rejected';
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE NOTICE 'Invalid program status rejected';
END
$$;

ROLLBACK;
