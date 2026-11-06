BEGIN;

-- Temporary fixture: this script exercises equivalent PostgreSQL constraints and guards.
-- The application transaction functions themselves are covered by the pure unit tests
-- and must be exercised through the application once an integration harness is added.
DO $$
DECLARE
  test_university_id uuid;
  test_program_id uuid;
  test_cycle_id uuid;
  first_level_id uuid;
  duplicate_refused boolean := false;
  changed_rows integer;
BEGIN
  INSERT INTO universities (name, slug)
  VALUES ('Structure mutation test fixture', 'structure-test-' || gen_random_uuid())
  RETURNING id INTO test_university_id;

  INSERT INTO programs (university_id, name, slug, status)
  VALUES (test_university_id, 'Test program', 'test-program', 'draft')
  RETURNING id INTO test_program_id;

  INSERT INTO cycles (university_id, name, short_code, years_count, "order")
  VALUES (test_university_id, 'Test cycle', 'T', 3, 1)
  RETURNING id INTO test_cycle_id;

  INSERT INTO program_cycles (program_id, university_id, cycle_id)
  VALUES (test_program_id, test_university_id, test_cycle_id);

  INSERT INTO levels (university_id, program_id, cycle_id, name, slug, year_number)
  VALUES (test_university_id, test_program_id, test_cycle_id, 'T1', 't1', 1)
  RETURNING id INTO first_level_id;

  INSERT INTO levels (university_id, program_id, cycle_id, name, slug, year_number)
  VALUES (test_university_id, test_program_id, test_cycle_id, 'T2', 't2', 2);

  BEGIN
    UPDATE levels
    SET year_number = 2, name = 'T2', slug = 't2'
    WHERE id = first_level_id AND university_id = test_university_id;
  EXCEPTION WHEN unique_violation THEN
    duplicate_refused := true;
  END;

  IF NOT duplicate_refused THEN
    RAISE EXCEPTION 'Expected an already-used cycle year number to be rejected';
  END IF;

  UPDATE levels
  SET year_number = 3, name = 'T3', slug = 't3'
  WHERE id = first_level_id AND university_id = test_university_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected a valid year number update to succeed';
  END IF;

  UPDATE cycles AS c
  SET short_code = 'X'
  WHERE c.id = test_cycle_id
    AND c.university_id = test_university_id
    AND NOT EXISTS (
      SELECT 1 FROM levels AS l
      WHERE l.cycle_id = c.id AND l.university_id = c.university_id
    );
  GET DIAGNOSTICS changed_rows = ROW_COUNT;

  IF changed_rows <> 0 THEN
    RAISE EXCEPTION 'Expected a cycle short code change with dependent levels to be refused';
  END IF;
END;
$$;

ROLLBACK;
