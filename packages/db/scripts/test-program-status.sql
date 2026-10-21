BEGIN;

DO $test$
DECLARE
  invalid_status_rejected boolean := false;
BEGIN
  BEGIN
    EXECUTE 'UPDATE programs SET status = ''invalid'' WHERE false';
  EXCEPTION WHEN invalid_text_representation THEN
    invalid_status_rejected := true;
  END;

  IF NOT invalid_status_rejected THEN
    RAISE EXCEPTION 'Le statut invalide a été accepté';
  END IF;
END;
$test$;

ROLLBACK;
