BEGIN;

DO $$
DECLARE
  test_university_id uuid := gen_random_uuid();
  super_admin_id uuid := gen_random_uuid();
  university_admin_id uuid := gen_random_uuid();
  student_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO universities (id, name, slug)
  VALUES (test_university_id, 'Identity constraint test', 'identity-test-' || test_university_id::text);

  INSERT INTO users (id, university_id, email, role)
  VALUES
    (super_admin_id, NULL, 'super-' || super_admin_id::text || '@example.invalid', 'super_admin'),
    (university_admin_id, test_university_id, 'admin-' || university_admin_id::text || '@example.invalid', 'university_admin'),
    (student_id, test_university_id, 'student-' || student_id::text || '@example.invalid', 'student');

  BEGIN
    INSERT INTO users (university_id, email, role)
    VALUES (test_university_id, 'invalid-super-' || gen_random_uuid()::text || '@example.invalid', 'super_admin');
    RAISE EXCEPTION 'CHECK allowed super_admin with university_id';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO users (email, role)
    VALUES ('invalid-student-' || gen_random_uuid()::text || '@example.invalid', 'student');
    RAISE EXCEPTION 'CHECK allowed student without university_id';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO accounts (user_id, type, provider, provider_account_id)
  VALUES (student_id, 'oauth', 'google', 'identity-test-' || student_id::text);

  BEGIN
    INSERT INTO accounts (user_id, type, provider, provider_account_id)
    VALUES (university_admin_id, 'oauth', 'google', 'identity-test-' || student_id::text);
    RAISE EXCEPTION 'UNIQUE allowed duplicate provider/account id';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO verification_tokens (identifier, token, expires)
  VALUES
    ('first@example.invalid', 'shared-test-token', now()),
    ('second@example.invalid', 'shared-test-token', now());

  BEGIN
    INSERT INTO verification_tokens (identifier, token, expires)
    VALUES ('first@example.invalid', 'shared-test-token', now());
    RAISE EXCEPTION 'PRIMARY KEY allowed duplicate identifier/token pair';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;

ROLLBACK;
