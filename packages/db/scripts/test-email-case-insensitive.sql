BEGIN;

DO $$
DECLARE
  test_university_id uuid;
  test_email text := 'case-check-' || gen_random_uuid()::text || '@example.invalid';
BEGIN
  INSERT INTO universities (name, slug)
  VALUES ('[TEST] Email index', 'test-email-' || gen_random_uuid()::text)
  RETURNING id INTO test_university_id;

  INSERT INTO users (university_id, email, role)
  VALUES (test_university_id, test_email, 'student');

  BEGIN
    INSERT INTO users (university_id, email, role)
    VALUES (test_university_id, upper(test_email), 'student');
    RAISE EXCEPTION 'Expected case-insensitive duplicate email to be rejected';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END
$$;

ROLLBACK;
