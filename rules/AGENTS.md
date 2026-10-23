# Tablino — contexte du projet

Lis ce fichier en entier avant toute action. Il remplace tout historique de conversation.

## Rôle attendu
Développeur senior full-stack. Le propriétaire (M-Y) est développeur. Vise qualité, robustesse, maintenabilité. Signale risques, erreurs et meilleures alternatives. Ne valide rien à l'aveugle. Réponses concises, en français. Environnement : Windows, PowerShell.

## Projet
PWA multi-universités : archive de cours et de devoirs, organisée par
Filière → Niveau → Année académique → Matière → Ressources (cours) ou Devoirs.
- Application étudiants (`apps/web`) : lecture seule, deux sections : Cours et Devoirs.
- Dashboard administration (`apps/admin`) : scan, upload, gestion de la structure. Les étudiants ne déposent rien.
- Multi-tenant : une plateforme, une base, isolation par `university_id`.
- Premier pilote visé : l'ISCOM. Aucune donnée réelle d'université dans le code ni dans le seed.

## Architecture
Monorepo pnpm + Turborepo.
```
apps/web        Next.js, étudiants, port 3000
apps/admin      Next.js, dashboard, port 3001
packages/db     Drizzle : schéma, migrations, seed, test d'isolation
packages/auth   authOptions next-auth partagé
```
Stack : Next.js 16.4.2 (App Router), React 19.3, TypeScript, Tailwind, next-auth v4, Drizzle ORM, PostgreSQL (Supabase), Cloudflare R2 (pas encore configuré), Lucide React pour les icônes.
Packages internes : `transpilePackages` dans chaque `next.config.ts`.

## Base de données
- Supabase. `packages/db/.env` : Session pooler, port 5432 (migrations). `apps/web/.env.local` : Transaction pooler, port 6543.
- Toute migration utilise le Session pooler, port 5432 ; ne pas utiliser le port 6543 pour les migrations.
- Pour lancer apps/admin en dev, apps/admin/.env.local doit contenir DATABASE_URL (même cible que .env.test) et UNIVERSITY_ID. Noms seulement, jamais de valeurs.
- Base de test autorisée : référence `xblapziuxietpjqewkwh` uniquement. Références interdites : `dmkhqphgxmgsgosvrylx` et `dfrlsuhllzqsqerqzsch`. Vérifier référence et port avant toute opération.
- Base de test xblapziuxietpjqewkwh conservée jusqu'à la fin de la phase de développement. Suppression à la demande de l'utilisateur seulement.
- Tables : universities, programs, levels, academic_years, subjects, resources (cours), assignments (devoirs), users, accounts, sessions, verification_tokens, subscriptions.
- Isolation : clés étrangères composites incluant `university_id`. Test : `db:test-isolation` (8 cas, doit rester vert).
- Statut : `programs.status` porte `draft` ou `published` ; seule une filière publiée est visible dans `apps/web`. Niveaux, matières et années suivent le statut de leur filière. Ressources et devoirs gardent leur propre statut. Le statut « disponible / à rendre / expiré » d'un devoir se calcule depuis l'échéance, jamais stocké.
- Année académique : globale à l'université, liée via `subjects.academic_year_id`.
- Migrations : uniquement `pnpm db:generate` puis `pnpm db:migrate`. Jamais `db:push`, jamais de SQL exécuté directement ni depuis le tableau de bord Supabase. Le suivi Drizzle doit rester cohérent avec la base.
- Seed : idempotent (UUID fixes), données marquées « DÉMO », rien de réel. Pour les cycles (id généré par la migration), upsert sur `(university_id, short_code)`, relire l'id pour les enfants.
- `levels.order` : supprimé par la migration 0006 de `feat/admin-structure` ; le tri repose sur `cycles.order`, puis `levels.year_number`. La migration 0006 est appliquée et vérifiée sur la base de test : 7 migrations, 2 filières `published`, colonne `levels.order` supprimée. Les nouvelles filières commencent en `draft`.
- Structure (`feat/admin-structure`) : refuser la suppression d'une entité ayant des dépendants ; aucune suppression en cascade depuis l'interface. Le `short_code` d'un cycle est immuable tant que des niveaux y sont rattachés.
- Mutations transactionnelles dans `packages/db/src/structure.ts` : `updateCycleYearsCount`, `updateLevelYearNumber`, `updateCycleShortCode`, `updateProgramStatus`. Les trois mutations de cycle/niveau verrouillent le cycle d'abord avec `SELECT ... FOR UPDATE` filtré par université ; aucun chemin ne doit prendre ces verrous dans l'ordre inverse. `updateProgramStatus` verrouille la filière ciblée, avec filtre d'université, et ne verrouille pas de cycle. `canReduceYearsCount` reste un alias exporté obsolète. `updateCycleShortCode` normalise le code en majuscules après trim ; une collision renvoie `short_code_taken`. Changer l'année d'un niveau régénère son nom et son slug ; les permutations de numéros sont refusées.
- Test d'intégration transactionnel de structure : `pnpm --filter @tablino/db db:test-structure`. Le script partage le garde de `_provisioning` (référence autorisée et port `5432`) et nettoie ses lignes temporaires ; ne pas l'ajouter au script unitaire `test`.
- Dans `test/db-isolation-cycles`, l'insertion de `"order"` dans `test-isolation.ts` concerne `cycles.order` ; elle n'écrit pas `levels.order`, supprimée en 0006.
- Journal des Server Actions de structure : `action`, `result` et `reason` sont limités par liste blanche, puis écrits via `console.info`; aucun identifiant, champ de formulaire, e-mail, secret ni objet/message d'erreur brut.
- Tests réels inter-universités et inspection : `pnpm --filter @tablino/db db:test-tenant-scope` et `pnpm --filter @tablino/db db:inspect-tenant-scope`. Les deux passent par `_database-guard` et `.env.test` ; refuser si `DATABASE_URL` est déjà définie dans le processus. L'inspecteur utilise une transaction `READ ONLY` et ne doit contenir aucune écriture. Il rapporte les marqueurs ZZ ancrés et les faux marqueurs séparément, ainsi que les migrations sans données personnelles.
- `test-tenant-scope` génère par exécution un suffixe aléatoire de 11 lettres majuscules ; les marqueurs parents ont la forme exacte `ZZ` + suffixe + `A` ou `B` (`^ZZ[A-Z]{12}$`). Exécuter un seul run à la fois : le nettoyage de démarrage et de fin cible tous les marqueurs valides. Après un kill brutal, relancer le script pour nettoyer les résidus au démarrage ; procédure manuelle Windows : lancer avec `--wait-for-sigint`, relever le PID Node, puis `Stop-Process -Id <PID> -Force` dans un autre terminal.
- Au SIGINT, le script attend le nettoyage ; délai maximal 15 secondes. En cas de `CLEANUP_TIMEOUT`, des résidus peuvent rester : relancer le script. Le scénario de dépassement du délai n'a pas été testé. Si un lancement échoue avec `ENOMEM` avant l'exécution, relancer une fois ; si l'erreur persiste, arrêter et rapporter l'erreur, sans contournement.
- Nettoyage ponctuel demandé : le résidu d'origine inconnue `ZZ31D033F20607` a été supprimé après vérification des comptes attendus ; les comptages de sa cible sont ensuite tous à zéro. L'université démo (2 filières, 3 cycles) et les totaux d'authentification (3 utilisateurs, 2 comptes, 3 sessions) sont restés inchangés. Aucune trace dans l'historique git ; générateur committé = 11 lettres sans chiffres.
- Tests unitaires sans base : `pnpm --filter @tablino/db test` et `pnpm --filter @tablino/auth test`. Ne pas y ajouter de contournement ni d'accès à une base.
- Paiement futur par université, pas par utilisateur. Dans `feat/auth-roles`, ne pas modifier `subscriptions` ni `users.subscription_expires_at`.

## Règles de travail (obligatoires)
1. Avant chaque grande modification : nouvelle branche depuis `develop`.
2. Une grande modification = plusieurs étapes. Un commit par étape, `pnpm build` réussi avant chaque commit.
3. Fin de la grande modification : push de la branche, puis PR vers `develop`.
4. Aucune modification importante sans mon autorisation explicite : propose d'abord un plan en étapes avec message de commit, attends mon accord.
5. Aucune opération sur la base de données (migration, seed, DROP, scripts) sans mon accord, après affichage du SQL ou de la liste des instructions.
6. Fusion dans `develop` ou `main` : jamais sans mon accord.
7. Un seul outil écrit du code à la fois.
8. Montre les erreurs avant de les corriger.
9. Ne jamais utiliser `git add .` ni `git add -A` ; indexer les chemins explicitement.
10. `.worktree-develop/` est exclu localement via `.git/info/exclude`.
11. Ne jamais lancer `next dev` ni `pnpm dev` sans demande explicite du propriétaire dans le message courant. `next dev` génère `apps/admin/AGENTS.md` (exclu localement via `.git/info/exclude`).
12. Déstructuration d'un résultat de requête : tester avec .length > 0.
13. Un redirect() ne va jamais dans un try/catch (runMutation en a un) : l'appeler après runMutation.
14. Un message d'erreur partagé (structure-action-utils.mjs) ne se modifie jamais sans contrôle de tous les usages de la raison dans packages/db/src et dans les tests.
15. Toute écriture en base, même une ligne via l'interface, exige le SQL (ou son équivalent lu dans le code) puis l'accord du propriétaire. Un accord autorise un seul envoi.
16. Ne jamais supposer le nom, l'existence ou le chemin d'une fonction ou d'un fichier : auditer d'abord.

## Sécurité
- Aucun secret, URL de connexion ni clé dans le code, les commits, les captures ou les réponses. Les fichiers `.env*` ne doivent jamais apparaître dans une capture. Ils sont ignorés par Git : vérifier avec `git status` avant chaque commit.
- `UNIVERSITY_ID` : variable serveur uniquement, jamais préfixée `NEXT_PUBLIC_`. Point d'entrée unique : `getCurrentUniversityId()`, à remplacer plus tard par l'identification par sous-domaine.
- Toute requête filtre par `university_id`. Contenu public : uniquement `status = published`.
- RLS Supabase : à activer sur toutes les tables du schéma public, sans politique (l'application utilise la connexion Postgres directe).
- Clés d'API : côté serveur uniquement.

## Authentification et roles (`feat/auth-roles`)
- Roles : `super_admin` (global), `university_admin` (une universite), `student`. L'ancien role `admin` est converti en `university_admin` ; `scanner` est supprime (donnees demo uniquement).
- CHECK `users_role_university_scope_check` : `super_admin` exige `university_id IS NULL` ; `university_admin` et `student` exigent `university_id IS NOT NULL`.
- Migrations versionnees : `0004_peaceful_marten_broadcloak.sql` ajoute l'identite et les roles ; `0005_fair_zzzax.sql` ajoute l'index unique `users_email_lower_unique` sur `lower(users.email)`. Verifier l'etat de chaque migration avant d'en lancer une nouvelle ; ne pas supposer qu'elle est appliquee.
- `packages/auth` utilise Google OAuth et l'adaptateur Drizzle sur `users`, `accounts`, `sessions`, `verification_tokens` ; les sessions sont persistees en base. Google dans `apps/web` cree uniquement des `student` ; `apps/admin` accepte uniquement les comptes provisionnes. Aucun role privilegie n'est attribue par inscription publique.
- Provisionnement operateur, sans session ni route publique : `pnpm --filter @tablino/db db:create-super-admin <email>` et `pnpm --filter @tablino/db db:create-university-admin <email> <slug-ou-id>`. Les scripts normalisent l'e-mail, refusent les doublons et ne modifient pas un utilisateur existant. `create-super-admin` refuse s'il existe deja un `super_admin` ; ne pas lancer plusieurs creations concurrentes.
- Garde commun des scripts dans `packages/db/scripts/_provisioning.ts` : `DATABASE_URL` doit viser le projet de test autorise, port `5432`. Le script charge `packages/db/.env` ; une variable deja definie dans le processus conserve la priorite. Toute autre base exige une autorisation explicite.
- Gardes serveur `requireSession`, `requireRole`, `requireUniversityAccess` dans `packages/auth/src/guards.ts` : la session est verifiee et role/universite sont relus dans `users` a chaque appel. `apps/admin` autorise `super_admin` globalement et `university_admin` dans son universite ; `apps/web` autorise les etudiants de l'universite courante. Anonyme : redirection `/api/auth/signin` ; role ou perimetre refuse : 403.
- Regle d'abonnement : un abonnement d'universite expire n'autorise plus l'acces aux contenus proteges ; le controle doit etre serveur. Cette regle reste a integrer avec la facturation future par universite. Ne pas modifier `subscriptions` ni `users.subscription_expires_at` dans `feat/auth-roles`.
- Variables d'environnement (noms de `.env.example` uniquement) : `DATABASE_URL`, `UNIVERSITY_ID`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `PAYMENT_WEBHOOK_SECRET`. Ne jamais documenter leurs valeurs.
- Reste : email/mot de passe, interface de gestion des comptes universitaires, controle d'abonnement expire sur les ressources, tests d'integration apres accord, domaine d'authentification central et validation de `callbackUrl`.

## Conventions
- Pages de lecture : Server Components, rendu dynamique (le build ne doit pas dépendre de la base ; vérifier avec `pnpm build` sans `DATABASE_URL`).
- Compteurs (« 5 niveaux • 12 matières ») : calculés par requête, jamais en dur.
- États obligatoires : chargement, vide, erreur, introuvable (`notFound()` pour slug inconnu).
- Bouton télécharger : désactivé avec message clair si `file_key` est nul. Aucun bouton décoratif.
- Téléchargement (futur, `feat/admin-upload`) : route `/api/download/[id]` — jamais de clé de fichier dans l'URL. Le serveur vérifie `university_id`, `status = published` et les droits d'abonnement, puis génère un lien signé à durée courte (Cloudflare R2 presigned URL). Tant que R2 n'est pas configuré, le bouton affiche « Bientôt disponible » (désactivé).
- Bouton Ouvrir (externalUrl) : URL validée côté serveur (`/^https?:\/\//`), `target="_blank"`, `rel="noopener noreferrer"`.
- Accessibilité : focus visible, navigation clavier, contrastes, libellés explicites. Responsive mobile-first.
- Identité visuelle : bleu universitaire, fond clair, cartes à coins arrondis, ombres discrètes, animations légères.
- Navigation par routes : `/cours/[programSlug]/[levelSlug]/[year]/[subjectSlug]`, idem `/devoirs/...`. Année dans l'URL = libellé (ex. 2026-2027).
- Pas de barre de recherche, d'avatar ni de promesses non vérifiées (« données sécurisées ») tant que non réalisés.
- Slugs créés par le dashboard : via une vraie fonction de slug (accents, doublons).
- Vocabulaire produit : niveau = année. L1 = Licence année 1. Le nombre d'années d'un cycle dans une filière définit ses niveaux : N années = L1 à LN. Interface : « Années : N ». Ne pas utiliser « niveaux » et « années » comme deux notions.

## Fonctionnalités prévues (ne pas implémenter sans demande)
- Authentification restante : email/mot de passe, interface de creation d'un `university_admin`, domaine d'authentification central, cookie de domaine et validation de `callbackUrl` contre une liste autorisee.
- Paiement : mobile money (Orange Money, Moov Money) via agrégateur (CinetPay, PayDunya ou Ligdicash), interface d'abstraction, pas de renouvellement automatique : abonnement par période avec date d'expiration, webhook vérifié côté serveur.
- Scan (dashboard) : caméra multi-pages, redressement, PDF, OCR (Tesseract), validation avant publication.
- Remise de devoirs par les étudiants : interdite sans validation préalable.

## Feuille de route
1. `feat/web-navigation` : design, layout, accueil, fil d'Ariane, pages filières, niveaux, années, matières, listes finales
2. `feat/auth-roles` : modele d'identite, Google OAuth, provisionnement ferme, gardes de role et d'universite (etapes 1 a 4 realisees)
3. Travail `feat/admin-structure`, réparti sur les branches suivantes dans cet ordre :
   1. `feat/admin-structure`
   2. `feat/db-command-guards`
   3. `fix/web-system-fonts`
   4. `test/db-isolation-cycles`
   5. `test/db-tenant-scope`
   Fusionnées dans `develop` (PR #6 à #10) ; `origin/develop` = `77b16ff`.
4. `feat/admin-upload` (R2) — lots db et page faits et fusionnés (PR #28), stockage simulé ; vrai stockage R2 bloqué.
5. `feat/admin-scan`
6. `feat/payments`
7. `feat/pwa`
8. `feat/auth-subdomain`

## État d'avancement (à mettre à jour après chaque branche)
- `feat/admin-shell` fusionnée (PR #12) ; PR #13 (état admin-shell) ; PR #14 `fix/auth-google-timeout` (`httpOptions.timeout` 10 s sur le provider Google, logger JSON sans métadonnées dans `packages/auth`) ; PR #15 `fix/admin-global-css` (import de `globals.css` dans le layout admin) ; `origin/develop` = `77b16ff`. Connexion Google admin confirmée en fenêtre privée, rendu de l'accueil admin vérifié à l'écran.
- `feat/admin-shell`, étapes 1 à 5 : identité visuelle, navigation responsive avec profil et déconnexion, composant `AdminPage` avec fil d'Ariane sur l'accueil et les pages de structure, cartes d'accueil Structure, Uploader un fichier et Scanner. Aucune lecture de base ajoutée ; gardes inchangées ; `packages/auth` intact. Le propriétaire a vérifié 13/13 tests admin, build OK et tsc code 0. Rendu visuel non vérifié.
- PR #19 à #22 fusionnées : durée portée par `program_cycles.years_count`, création de cycles dans l’administration, styles de structure et résolution d’une université courante pour la navigation et les actions.
- PR #23, #25, #26, #27 fusionnées. admin-structure terminée avec la PR #26. Rendu visuel validé à l'écran par le propriétaire.
- PR #28 feat/admin-upload-page fusionnée (fusion 4a5af2c) : page /upload, formulaire (Type, Filière, Niveau, Année académique, Matière, Titre, Fichier), uploadFileAction, createResource, createAssignment, inferResourceFormat. Stockage SIMULÉ : aucun objet écrit, statut draft. Taille max 20 Mio dans l'action, bodySizeLimit 25mb côté Next.
- PR #29 chore/db-inspect-resources fusionnée (fusion 1ab869f) : script db:inspect-resources, lecture seule, transaction READ ONLY.
- PR #30 feat/admin-upload-optional-title fusionnée (fusion fb4573d) : titre facultatif à l'envoi ; sans titre, nom du fichier sans extension, limité à 255 points de code (buildUploadTitle).
- PR #31 feat/admin-cycle-rename-help fusionnée (fusion 2e7f64b) : aide « Ce nom est partagé par toutes les filières. » sous le renommage d'un cycle dans le détail d'une filière. Renommer un cycle renomme le cycle global.
- PR #32 docs/agents-md-state fusionnée (fusion 2ccb635) : mise à jour de rules/AGENTS.md (état, règles 12 à 16, vocabulaire).
- Fusions faites sans accord explicite : 14 (PR #6, 7, 8, 11, 12, 13, 14, 15, 25, 28, 29, 30, 31, 32). Pour les PR #26 et #27, le respect de la règle n'a pas été vérifié.
- La ligne de test de l'envoi (table resources) a été supprimée. Lecture après suppression : 3 lignes, 0 brouillon. Origine des 3 lignes restantes : non prouvée.
- Points ouverts : vrai stockage R2 bloqué (aucune dépendance @aws-sdk dans apps/admin) ; envoi de type Devoir jamais testé ; refus blocking_levels non reproduit, message de refus générique laissé tel quel ; valeur d'années par défaut à l'ajout d'un cycle à une filière : laissée vide, abandonnée.
- Pile admin-structure entièrement fusionnée (PR #6 à #10), 21/10/2026.
- Vérifications rapportées par l'utilisateur le 21/10/2026 : tests admin 7/7 ; `db:test-structure` 9 OK ; `db:test-tenant-scope` OK ; inspection après identique à l'état avant, ZZ = 0. L'inspecteur n'affiche pas les comptages de `program_cycles` (6) ni de `levels` (16). Build forcé OK ; quatre `tsc --noEmit` avec code 0. Les deux tests de base ont été lancés par l'utilisateur, pas par Codex.
- `feat/db-command-guards` : garde centralisé pour les commandes de base ; commits clés `74bb3ef`, `0d6c282`, `6f6ac9d`.
- `fix/web-system-fonts` : remplacement de la police Google par une pile système ; commit clé `efcbff3`.
- `test/db-isolation-cycles` : tests d'isolation adaptés aux cycles et aux deux clés étrangères possibles ; commits clés `157a99b`, `0fc4493`.
- `test/db-tenant-scope` : tests réels inter-universités, marqueurs et nettoyage, journal sûr et inspection gardée ; commits clés `2417713`, `268f346`, `abf5694`, `dfb474b`, `63335ea`, `d098b49`.
- Ordre des PR : `admin-structure` → `db-command-guards` → `web-system-fonts` → `db-isolation-cycles` → `db-tenant-scope`.
- Le seed ne s'exécute pas sur la base de test sans accord explicite.
- Fait sur `feat/auth-roles`, etapes 1 a 4 : modele d'identite, migrations 0004/0005, Google OAuth avec adaptateur Drizzle et sessions en base, scripts de provisionnement, gardes serveur ; six cas de test ecrits. Etat d'application des migrations et tests d'integration a confirmer avant toute commande base.
- Fait : monorepo, schéma hiérarchique, migrations 0000 à 0002, seed idempotent (UUID fixes), test d'isolation 8/8 — commités sur `feat/db-levels-slug`.
- Fait : RLS (migration 0002), push + PR de `feat/db-levels-slug` vers `develop` — fusionné.
- Fait : `feat/web-navigation` — navigation Filière→Niveau→Année→Matière→Ressources|Devoirs. Push + PR vers `develop` — fusionné.
- Fait sur `feat/db-cycles` : schéma `cycles`, `program_cycles` et `levels.cycle_id` / `year_number` ; migration `0003_colorful_franklin_richards.sql` ; seed idempotent des cycles ; pages cours/devoirs groupées par cycle ; garde transactionnel `canReduceYearsCount` dans `packages/db/src/cycles.ts`.
- Migration 0003 appliquée et vérifiée sur la base de test autorisée. Garde testé sur cette base : 6 cas conformes.
- Vérifications locales : `pnpm build` et `pnpm exec tsc --noEmit` réussis pour les étapes web et db.
- Fait sur `feat/admin-structure`, étape 1 : `programs.status` (défaut `draft`), filières existantes migrées vers `published`, `levels.order` supprimé en 0006, seed démo publiée, toutes les requêtes web filtrent les filières publiées ; scripts de tests unitaires sans base ajoutés. SQL de test du statut écrit mais non exécuté. Build et tsc db/auth/web réussis.
- Fait sur `feat/admin-structure`, étape 2 : mutations transactionnelles `updateCycleYearsCount`, `updateLevelYearNumber` (plage, unicité du numéro et du slug, nom/slug régénérés) et `updateCycleShortCode` (normalisation trim/majuscules, validation, collision distincte et refus si des niveaux existent). Verrouillage du cycle en premier et filtrage par université. Tests purs écrits dans `packages/db/tests/structure.test.ts` ; `scripts/test-structure-mutations.sql` écrit, non exécuté. `scripts/test-structure-integration.ts` et la commande `db:test-structure` écrits, non exécutés. Build et tsc db réussis ; les tests restent à exécuter par l'utilisateur.
- Tests unitaires sans base : l'utilisateur a exécuté les 2 tests db et les 6 tests auth, 8/8 réussis. Ils échouent dans l'environnement de l'assistant avec `ENOMEM` ; aucun contournement n'est permis.
- Fait sur `feat/admin-structure`, étape 3 : pages de lecture `/structure` et `/structure/[universityId]` dans `apps/admin`, sélecteur d'universités réservé au `super_admin`, redirection du `university_admin` vers sa propre université, affichage des filières brouillon et publiées, cycles et niveaux triés, années académiques et matières. Les accès sont gardés et les lectures de structure filtrent `university_id`.
- Tests purs de regroupement et de tri écrits dans `apps/admin/tests/structure-view.test.mjs`, script `pnpm --filter @tablino/admin test` ajouté, non exécuté par l'assistant conformément à la demande. Build et `tsc --noEmit` de l'admin réussis ; le build monorepo reste bloqué par le téléchargement de la police Google dans `apps/web`.
- Fait sur `feat/admin-structure`, étape 4 : mutation transactionnelle `updateProgramStatus` avec validation pure ; test unitaire pur et script SQL `BEGIN`/`ROLLBACK` écrits, non exécutés. Quatre Server Actions pour les mutations de cycle, niveau et filière revérifient rôle et université, valident les champs, renvoient des messages français sans détails techniques et revalident la page après succès. Formulaires simples ajoutés à la page de structure. Build et `tsc --noEmit` db/admin réussis ; tests non exécutés par l'assistant.
- Dans `feat/admin-structure`, passer une filière en `draft` est autorisé même si elle contient des ressources ou devoirs publiés. Toute future suppression doit être refusée si des dépendants existent, sans cascade depuis l'interface.
- En attente : domaine `tablino.com`, compte Cloudflare R2, accord de l'ISCOM pour le pilote, rotation des mots de passe Supabase.
