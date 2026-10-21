-- ============================================================
-- Test d'intégrité référentielle — feat/db-cycles
-- Chaque bloc est une transaction annulée : aucun effet en base.
-- Lancer sur la base jetable après application de la migration 0003.
-- Remplacer les variables avant exécution :
--   \set UNI_ID  '<uuid-université>'
--   \set PROG_ID '<uuid-programme>'
--   \set CYC_ID  '<uuid-cycle>'
--   \set LVL_ID  '<uuid-level>'
-- ============================================================

-- ── Test 1 : suppression d'une université entière (doit réussir) ──
-- Cascade attendue : programs → program_cycles + cycles → levels → subjects → resources/assignments
BEGIN;
DELETE FROM universities WHERE id = :'UNI_ID';
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM programs   WHERE university_id = :'UNI_ID') = 0, 'programs non supprimés';
  ASSERT (SELECT COUNT(*) FROM cycles     WHERE university_id = :'UNI_ID') = 0, 'cycles non supprimés';
  ASSERT (SELECT COUNT(*) FROM levels     WHERE university_id = :'UNI_ID') = 0, 'levels non supprimés';
  ASSERT (SELECT COUNT(*) FROM subjects   WHERE university_id = :'UNI_ID') = 0, 'subjects non supprimés';
  RAISE NOTICE 'Test 1 OK : suppression université en cascade';
END $$;
ROLLBACK;

-- ── Test 2 : suppression d'un program_cycles avec niveaux rattachés (doit échouer) ──
BEGIN;
DO $$
BEGIN
  BEGIN
    DELETE FROM program_cycles WHERE program_id = :'PROG_ID' AND cycle_id = :'CYC_ID';
    RAISE EXCEPTION 'Test 2 ÉCHEC : suppression aurait dû être refusée';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'Test 2 OK : suppression program_cycles refusée (levels_program_cycle_fk NO ACTION)';
  END;
END $$;
ROLLBACK;

-- ── Test 3 : suppression d'un cycle utilisé par des niveaux (doit échouer) ──
BEGIN;
DO $$
BEGIN
  BEGIN
    DELETE FROM cycles WHERE id = :'CYC_ID';
    RAISE EXCEPTION 'Test 3 ÉCHEC : suppression aurait dû être refusée';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'Test 3 OK : suppression cycle refusée (levels_cycle_university_fk NO ACTION)';
  END;
END $$;
ROLLBACK;

-- ── Test 4 : short_code avec chiffre (doit échouer) ──
BEGIN;
DO $$
BEGIN
  BEGIN
    INSERT INTO cycles (university_id, name, short_code, years_count, "order")
    VALUES (:'UNI_ID', 'Test', 'L2', 3, 99);
    RAISE EXCEPTION 'Test 4 ÉCHEC : INSERT aurait dû être refusé';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Test 4 OK : short_code "L2" refusé (cycles_short_code_letters)';
  END;
END $$;
ROLLBACK;

-- ── Test 5 : year_number = 0 (doit échouer) ──
BEGIN;
DO $$
BEGIN
  BEGIN
    UPDATE levels SET year_number = 0 WHERE id = :'LVL_ID';
    RAISE EXCEPTION 'Test 5 ÉCHEC : UPDATE aurait dû être refusé';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Test 5 OK : year_number = 0 refusé (levels_year_number_min)';
  END;
END $$;
ROLLBACK;

-- ── Test 6 : years_count hors plage (doit échouer) ──
BEGIN;
DO $$
BEGIN
  BEGIN
    INSERT INTO cycles (university_id, name, short_code, years_count, "order")
    VALUES (:'UNI_ID', 'Test', 'X', 11, 99);
    RAISE EXCEPTION 'Test 6 ÉCHEC : INSERT aurait dû être refusé';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Test 6 OK : years_count = 11 refusé (cycles_years_count_range)';
  END;
END $$;
ROLLBACK;
