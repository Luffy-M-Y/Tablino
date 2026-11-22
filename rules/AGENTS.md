# Tablino — contexte du projet

Lis ce fichier en entier avant toute action. Il remplace tout historique de conversation.

## Rôle attendu
Développeur senior full-stack. Le propriétaire (M-Y) est développeur. Vise qualité, robustesse, maintenabilité. Signale risques, erreurs et meilleures alternatives. Ne valide rien à l'aveugle. Réponses concises, en français. Environnement : Windows, PowerShell.

## Projet
PWA multi-universités : archive de cours et de devoirs, organisée par
Filière → Niveau → Année académique → Matière → Ressources (cours) ou Devoirs.
- Application étudiants (`apps/web`) : lecture seule, deux sections : Cours et Devoirs.
- Dashboard administration (`apps/admin`) : scan, upload, gestion de la structure, gestion des cours, devoirs et brouillons (recherche et suppression). Les étudiants ne déposent rien.
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
Dépendances autorisées dans apps/admin : pdf-lib ^1.17.1 et tesseract.js ^7.0.0 (allowBuilds tesseract.js: false). Toute autre dépendance : accord du propriétaire.

## Base de données
- Supabase. `packages/db/.env` : Session pooler, port 5432 (migrations). `apps/web/.env.local` : Transaction pooler, port 6543.
- Toute migration utilise le Session pooler, port 5432 ; ne pas utiliser le port 6543 pour les migrations.
- Pour lancer apps/admin en dev, apps/admin/.env.local doit contenir DATABASE_URL (même cible que .env.test) et UNIVERSITY_ID. Noms seulement, jamais de valeurs.
- Base de test autorisée : référence `xblapziuxietpjqewkwh` uniquement. Références interdites : `dmkhqphgxmgsgosvrylx` et `dfrlsuhllzqsqerqzsch`. Vérifier référence et port avant toute opération.
- Base de test xblapziuxietpjqewkwh conservée jusqu'à la fin de la phase de développement. Suppression à la demande de l'utilisateur seulement.
- Tables : universities, programs, levels, academic_years, subjects, resources (cours), assignments (devoirs), access_codes, users, admin_invitations, admin_invitation_audit, admin_invitation_codes, admin_invitation_alert_outbox, admin_revocation_audit, admin_revocation_alert_outbox, accounts, sessions, verification_tokens, subscriptions, email_verification_codes, password_reset_codes, auth_attempts.
- Migration 0024 (`0024_round_serpent_society.sql`) : ajoute les tables `admin_revocation_audit` et `admin_revocation_alert_outbox`.
- Clés étrangères vers `users.id` : 15 au total dans le schéma (13 antérieures + `admin_revocation_audit.revoked_user_id` et `revoked_by_user_id`, toutes deux avec `onDelete: "set null"`).
- Règle harnais de test DB : la chaîne réelle de Drizzle pour les requêtes verrouillées d'outbox est `.where().orderBy().limit(1).for("update", { skipLocked: true })` ; dans un harnais simulant Drizzle, `limit()` doit renvoyer un objet attendable qui possède aussi la méthode `.for()` résolvant vers le même résultat, consommant les lignes simulées une seule fois. Dans `admin-revocation.ts`, la chaîne de verrouillage est `.for("update").limit(1)`.
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
- Journal des Server Actions de structure : `action`, `result` et `reason` sont limités par liste blanche, puis écrits via `console.info` ; aucun identifiant, champ de formulaire, e-mail, secret ni objet/message d'erreur brut.
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
17. PowerShell : Select-String sans -Recurse ; utiliser Get-ChildItem -Recurse -Filter. Chemins avec crochets : -LiteralPath, ou git add avec la forme :(literal)chemin entre guillemets.
18. Composants client : jamais crypto.randomUUID ; compteur dans un useRef.
19. Le script test de apps/admin/package.json liste les fichiers à la main : tout nouveau fichier de test y est ajouté. packages/db utilise des fichiers dans tests/ dont le nom finit par .test.ts ; les tests de packages/db et packages/email sont pris par motif.
20. Module .mjs importé depuis TypeScript : extension dans l'alias, avec un fichier .d.mts.
21. Nouvelle dépendance : accord du propriétaire, puis pnpm add par le propriétaire ; jamais pnpm approve-builds sans accord.
22. Assets (OCR, langue) : locaux dans apps/admin/public, jamais depuis un CDN.
23. Toute nouvelle action de runMutation s'ajoute à la liste de actions.ts ET au Set mutationActions de structure-action-utils.mjs.
24. Recherche côté client : filtre pur dans un module .mjs avec test ; le composant client reçoit des données sérialisables (Date en ISO).
25. Utiliser git --no-pager pour log, diff, show et branch.
26. Script jetable avec id codé en dur : non gardé. Pour un SELECT ad hoc : script tmp- non commité, supprimé après.
27. Publication ou écriture visible du site public : base de test seulement.
28. Interdiction : ne JAMAIS écrire « export const instant » dans apps/admin (cacheComponents n'étant pas activé, cela provoque une erreur 500 sur la route).
29. Tout nouvel appelant de `resolveSessionAllowed` doit fournir les cinq champs (`userFound`, `revokedAt`, `role`, `userUniversityId`, `hostUniversityId`) ; ne jamais assouplir ces contrôles.

## Sécurité
- Aucun secret, URL de connexion ni clé dans le code, les commits, les captures ou les réponses. Les fichiers `.env*` ne doivent jamais apparaître dans une capture. Ils sont ignorés par Git : vérifier avec `git status` avant chaque commit.
- `UNIVERSITY_ID` : variable serveur uniquement, jamais préfixée `NEXT_PUBLIC_`. Point d'entrée unique : `getCurrentUniversityId()`, à remplacer plus tard par l'identification par sous-domaine.
- Toute requête filtre par `university_id`. Contenu public : uniquement `status = published`.
- RLS Supabase : à activer sur toutes les tables du schéma public, sans politique (l'application utilise la connexion Postgres directe).
- Clés d'API : côté serveur uniquement.

## Authentification et roles (`feat/auth-roles`)
- Rôles : `super_admin` (global), `university_admin` (une université), `student`. L'ancien rôle `admin` est converti en `university_admin` ; `scanner` est supprimé (données démo uniquement).
- CHECK `users_role_university_scope_check` : `super_admin` exige `university_id IS NULL` ; `university_admin` et `student` exigent `university_id IS NOT NULL`.
- Migrations versionnées : `0004_peaceful_marten_broadcloak.sql` ajoute l'identité et les rôles ; `0005_fair_zzzax.sql` ajoute l'index unique `users_email_lower_unique` sur `lower(users.email)`. Vérifier l'état de chaque migration avant d'en lancer une nouvelle ; ne pas supposer qu'elle est appliquée.
- Migration `0015_mean_betty_ross.sql` : codes de réinitialisation de mot de passe ; appliquée et vérifiée sur la base de test autorisée le 06/11/2026.
- `packages/auth` utilise Google OAuth et l'adaptateur Drizzle sur `users`, `accounts`, `sessions`, `verification_tokens` ; les sessions sont persistées en base. Google dans `apps/web` crée uniquement des `student` ; `apps/admin` accepte uniquement les comptes provisionnés. Aucun rôle privilégié n'est attribué par inscription publique.
- Provisionnement opérateur, sans session ni route publique : `pnpm --filter @tablino/db db:create-super-admin <email>` (saisie interactive masquée et confirmée du mot de passe) et `pnpm --filter @tablino/db db:create-university-admin <email> <slug-ou-id>`. Les scripts normalisent l'e-mail, refusent les doublons et ne modifient pas un utilisateur existant. `create-super-admin` refuse s'il existe déjà un `super_admin` ; ne pas lancer plusieurs créations concurrentes.
- `packages/db/scripts/_provisioning.ts` ne charge pas de fichier d'environnement : `openProvisioningDatabase()` délègue à `openGuardedDatabase()`. `packages/db/scripts/_database-guard.ts` charge `packages/db/.env.test` sans écraser une `DATABASE_URL` déjà définie, puis valide la cible avant d'ouvrir le pool. Les scripts de test refusent séparément toute `DATABASE_URL` préexistante.
- Hôtes : étudiants `{slug}.{domaine}` ; admin d'université `{slug}-admin.{ADMIN_ROOT_DOMAIN}` ; super admin `sup-admin.{ADMIN_ROOT_DOMAIN}` (non public, slug `sup` réservé) ; hôte central Google admin `auth-admin.{ADMIN_ROOT_DOMAIN}` (slug `auth` réservé). Le domaine racine nu sert au futur site vitrine et répond 404. En local : `ADMIN_ROOT_DOMAIN=localhost:3001`, hôte central `127.0.0.1:3001`. Le super admin se connecte par mot de passe seulement, sur `sup-admin`.
- L'alerte d'approbation construit le lien `/approvals` sur `sup-admin.{ADMIN_ROOT_DOMAIN}` via `resolveApprovalsUrl`, en HTTPS seulement si `NODE_ENV === "production"`. Si `ADMIN_ROOT_DOMAIN` est absent ou invalide, l'e-mail part sans lien, une erreur est journalisée et le notifier ne bloque pas l'inscription ni la vérification d'e-mail.
- Google admin : le flux central utilise `/auth-admin/start`, `/auth-admin/signin`, `/auth-admin/transfer`, `/auth-admin/return` et `/auth-admin/error`, avec le cookie `tablino-admin-oauth-tx`. Les tickets OAuth sont liés à la surface. En mode central, seul un `university_admin` de la bonne université est accepté ; `linkAccount` refuse toute liaison sur le central et `markGoogleEmailVerified` n'est pas appelé pour l'admin. Les redirections sont construites depuis l'en-tête `Host` validé.
- Compte existant : un compte créé par mot de passe n'est jamais lié automatiquement à Google. Le retour se fait sur `/login?googleExisting=<jeton>` ; ce jeton AES-256-GCM contient l'e-mail et l'université, expire après 10 minutes et n'est pas à usage unique. Le message est construit par `getAdminGoogleExistingAccountMessage`.
- Scripts DB en base de test : `diagnose-admin-google-account.ts` est en lecture seule. `unlink-admin-google-account.ts` est en dry-run par défaut ; `--apply` est requis pour écrire, et l'opération transactionnelle supprime au plus une ligne `google` pour l'utilisateur ciblé. Ces scripts passent par `_database-guard.ts` et refusent une `DATABASE_URL` déjà définie.
- Gardes serveur `requireSession`, `requireRole`, `requireUniversityAccess` dans `packages/auth/src/guards.ts` : la session est vérifiée et rôle/université sont relus dans `users` à chaque appel. `apps/admin` autorise `super_admin` globalement et `university_admin` dans son université ; `apps/web` autorise les étudiants de l'université courante. Anonyme : redirection `/api/auth/signin` ; rôle ou périmètre refusé : 403.
- Retour de l'hôte central (`apps/web`) : `apps/web/src/app/auth-central/return/route.ts` relit `users.revokedAt`, `users.role` et `users.universityId` avant `createStudentSession`.
- `resolveSessionAllowed` (`apps/web/src/lib/auth-central-return.mjs`) reçoit `{ userFound, revokedAt, role, userUniversityId, hostUniversityId }` ; les cinq champs sont obligatoires. Refus si : utilisateur absent, compte révoqué, rôle différent de `student`, université de l'utilisateur nulle ou vide, ou université différente de celle de l'hôte. Tout refus redirige en 307 vers `/connexion`, sans paramètre, sans journal ni motif visible.
- Tests de `resolveSessionAllowed` : `apps/web/tests/auth-central-return.test.mjs` et `apps/web/tests/auth-flow-simulation.test.mjs` ; le script `test` de `apps/web` utilise le motif `tests/*.test.mjs`.
- Règle d'abonnement : un abonnement d'université expiré n'autorise plus l'accès aux contenus protégés ; le contrôle doit être serveur. Cette règle reste à intégrer avec la facturation future par université. Ne pas modifier `subscriptions` ni `users.subscription_expires_at` dans `feat/auth-roles`.
- Variables d'environnement (noms de `.env.example` uniquement) : `DATABASE_URL`, `UNIVERSITY_ID`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`, `CLOUDFLARE_TURNSTILE_SECRET_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `PAYMENT_WEBHOOK_SECRET`. Ne jamais documenter leurs valeurs.
- L'authentification par e-mail/mot de passe (inscription, connexion, vérification et réinitialisation) est implémentée dans `apps/web` et `apps/admin`. La réinitialisation admin utilise des cookies et jetons isolés du web, un code à durée limitée, des limites de débit, une réponse générique et l'invalidation des sessions après changement du mot de passe. Turnstile protège les actions publiques d'authentification admin, y compris l'inscription finale après Google OAuth ; le déclenchement direct de Google OAuth reste hors protection Turnstile.
- Reste : interface de gestion des comptes universitaires, contrôle d'abonnement expiré sur les ressources, tests d'intégration après accord, domaine d'authentification central et validation de `callbackUrl`.

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
- Barre de recherche et menu du compte (avatar) réalisés dans l'interface admin. Ne pas les annoncer dans une autre interface avant vérification ; aucune promesse non vérifiée (« données sécurisées »).
- Slugs créés par le dashboard : via une vraie fonction de slug (accents, doublons).
- Vocabulaire produit : niveau = année. L1 = Licence année 1. Le nombre d'années d'un cycle dans une filière définit ses niveaux : N années = L1 à LN. Interface : « Années : N ». Ne pas utiliser « niveaux » et « années » comme deux notions.
- Vocabulaire dashboard : ressource = cours (table resources) ; devoir = table assignments. Upload = envoi d'un fichier ; Scan = page séparée (caméra et images) ; les deux passent par DocumentForm.
- Brouillon a deux sens : (1) un fichier (cours ou devoir) avec status draft, listé sur /drafts, publié par le bouton Publier ou directement à l'envoi par la case Publier directement ; (2) une filière avec programs.status draft, statut changé sur la page de détail de la filière.
- Un fichier publié dans une filière en brouillon reste invisible sur le site public : les deux statuts sont filtrés.

### Admin : conventions d'interface
- Kit d'interface : `apps/admin/src/components/admin-ui.tsx` (`AdminCard`, `AdminLinkCard`, styles de boutons et de champs) ; utiliser `AdminPage` pour l'en-tête. Les nouveaux jetons admin portent le préfixe `admin-` dans `apps/admin/src/app/globals.css` ; ne pas modifier les jetons partagés avec `apps/web` (un test vérifie qu'ils sont identiques).
- Animation de survol uniquement sur les éléments cliquables (cartes-liens, lignes de liste, boutons) ; conteneurs de formulaire et de tableau statiques. Toujours respecter `motion-reduce` et rendre le focus visible.
- Menu latéral : replié par défaut à partir de `md`, déplié au survol ou au focus clavier avec décalage de la page ; bouton d'épinglage mémorisé dans `localStorage` ; tiroir sous `md`. Les entrées sont filtrées par rôle dans `apps/admin/src/lib/admin-menu.mjs`.
- En-tête : afficher le nom et l'acronyme de l'université pour `university_admin`, transmis via `GuardUser` (`universityName`, `universityAcronym`).
- Brouillons : `/drafts` (deux cartes), `/drafts/programs`, `/drafts/files`. Les actions qui modifient des brouillons invalident ces trois routes.
- Codes d'accès : aucune suppression de codes (un code utilisé est référencé par `users.access_code_id`). Les codes inactifs (expirés, épuisés, révoqués) sont masqués par défaut ; les afficher avec `?inactifs=1`.

## Fonctionnalités prévues (ne pas implémenter sans demande)
- Authentification restante : e-mail/mot de passe, interface de création d'un `university_admin`, domaine d'authentification central, cookie de domaine et validation de `callbackUrl` contre une liste autorisée.
- Paiement : mobile money (Orange Money, Moov Money) via agrégateur (CinetPay, PayDunya ou Ligdicash), interface d'abstraction, pas de renouvellement automatique : abonnement par période avec date d'expiration, webhook vérifié côté serveur.
- Scan (dashboard) : caméra multi-pages, redressement, PDF, OCR (Tesseract), validation avant publication. Fait (PR #37 et #38).
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
5. `feat/admin-scan` — fait et fusionné (PR #37 et #38)
6. `feat/payments`
7. `feat/pwa`
8. `feat/auth-subdomain`

## État d'avancement (à mettre à jour après chaque branche)
- `feat/admin-shell` fusionnée (PR #12) ; PR #13 (état admin-shell) ; PR #14 `fix/auth-google-timeout` (`httpOptions.timeout` 10 s sur le provider Google, logger JSON sans métadonnées dans `packages/auth`) ; PR #15 `fix/admin-global-css` (import de `globals.css` dans le layout admin) ; `origin/develop` = `77b16ff`. Connexion Google admin confirmée en fenêtre privée, rendu de l'accueil admin vérifié à l'écran.
- `feat/admin-shell`, étapes 1 à 5 : identité visuelle, navigation responsive avec profil et déconnexion, composant `AdminPage` avec fil d'Ariane sur l'accueil et les pages de structure, cartes d'accueil Structure, Uploader un fichier et Scanner. Aucune lecture de base ajoutée ; gardes inchangées ; `packages/auth` intact. Le propriétaire a vérifié 13/13 tests admin, build OK et tsc code 0. Rendu visuel non vérifié.
- PR #19 à #22 fusionnées : durée portée par `program_cycles.years_count`, création de cycles dans l'administration, styles de structure et résolution d'une université courante pour la navigation et les actions.
- PR #23, #25, #26, #27 fusionnées. admin-structure terminée avec la PR #26. Rendu visuel validé à l'écran par le propriétaire.
- PR #28 feat/admin-upload-page fusionnée (fusion 4a5af2c) : page /upload, formulaire (Type, Filière, Niveau, Année académique, Matière, Titre, Fichier), uploadFileAction, createResource, createAssignment, inferResourceFormat. Stockage SIMULÉ : aucun objet écrit, statut draft. Taille max 20 Mio dans l'action, bodySizeLimit 25mb côté Next.
- PR #29 chore/db-inspect-resources fusionnée (fusion 1ab869f) : script db:inspect-resources, lecture seule, transaction READ ONLY.
- PR #30 feat/admin-upload-optional-title fusionnée (fusion fb4573d) : titre facultatif à l'envoi ; sans titre, nom du fichier sans extension, limité à 255 points de code (buildUploadTitle).
- PR #31 feat/admin-cycle-rename-help fusionnée (fusion 2e7f64b) : aide « Ce nom est partagé par toutes les filières. » sous le renommage d'un cycle dans le détail d'une filière. Renommer un cycle renomme le cycle global.
- PR #32 docs/agents-md-state fusionnée (fusion 2ccb635) : mise à jour de rules/AGENTS.md (état, règles 12 à 16, vocabulaire).
- PR #33 docs/agents-md-pr32 fusionnée (fusion 8b0dbe4) : compteur d'entorses à 14 et PR #32 dans rules/AGENTS.md.
- PR #34 test/db-create-assignment-invalid fusionnée (fusion d4661e0) : 2 tests createAssignment (titre vide, fichier invalide) dans packages/db/tests/uploads.test.ts.
- PR #35 docs/agents-md-pr34 fusionnée (fusion b9f37f3).
- PR #36 fix/admin-cycle-delete-alignment fusionnée (fusion 1c2c5de).
- PR #37 feat/admin-scan-capture fusionnée (fusion eed90e7).
- PR #38 feat/admin-scan-pdf fusionnée (fusion 95e9ff4) : lot C. Scan multi-pages, PDF image avec texte OCR invisible (français), formulaire partagé Upload et Scan, brouillons, publication directe.
- PR #39 feat/admin-files-manage fusionnée (fusion 9f99a26) : pages Cours (/resources), Devoirs (/assignments), Brouillons (/drafts) avec recherche et suppression ; deleteResource et deleteAssignment dans packages/db/src/remove-files.ts ; 21 fichiers, 804 insertions, 58 suppressions.
- Fusions faites sans accord explicite : 20 (PR #6, 7, 8, 11, 12, 13, 14, 15, 25, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38). Pour les PR #26 et #27, le respect de la règle n'a pas été vérifié. La PR #39 a été fusionnée après accord.
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
- Fait sur `feat/auth-roles`, étapes 1 à 4 : modèle d'identité, migrations 0004/0005, Google OAuth avec adaptateur Drizzle et sessions en base, scripts de provisionnement, gardes serveur ; six cas de test écrits. État d'application des migrations et tests d'intégration à confirmer avant toute commande base.
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
- En cours sur `feat/web-turnstile` : le widget Cloudflare Turnstile et la validation Siteverify fail-closed protègent dans `apps/web` la connexion, les inscriptions e-mail/Google, la vérification/renvoi d'e-mail et toutes les étapes de réinitialisation du mot de passe. Validation locale auth/web réussie ; configuration des clés et test visuel restent à faire. OAuth Google avant/après les Server Actions et `apps/admin` restent hors périmètre de cette étape.

## Rôles super-admin et invitations (`feat/admin-invitations-roles`)

### Rôles super
- Trois rôles super, accessibles sur l'hôte `sup-admin` uniquement :
  - `super_admin` : le chef, unique, intouchable, provisionné par script `db:create-super-admin`. Exclu de la connexion Google (décision confirmée, connexion par mot de passe uniquement).
  - `super_admin_editor` : invite et révoque seulement des lectors ; éligible à la connexion Google sur `sup-admin`.
  - `super_admin_lector` : lecture seule ; éligible à la connexion Google sur `sup-admin`.
- Table `admin_invitations` : stocke les invitations en attente et acceptées. Matrice de permissions dans `apps/admin/src/lib/admin-permissions.mjs`.
- Trigger de protection du chef (`users_protect_super_admin_identity`) : empêche la suppression, la révocation et le changement de rôle du `super_admin` chef en base.
- Permission `admins` (`apps/admin/src/lib/admin-permissions.mjs`) :
  - Accordée uniquement à `super_admin` et `super_admin_editor`.
  - Matrice `getRevocableAdminRoles(actorRole)` : le chef (`super_admin`) peut révoquer `super_admin_editor` et `super_admin_lector` ; l'éditeur (`super_admin_editor`) peut révoquer `super_admin_lector` uniquement ; le lecteur (`super_admin_lector`) ne peut rien révoquer.
  - Règles : révoquer un editor = chef seul ; révoquer un lector = chef et editor ; personne ne peut révoquer le chef ni révoquer son propre compte (auto-révocation interdite).
- Services db de révocation (`packages/db/src/admin-revocation.ts` et `admin-revocation-outbox.ts`) :
  - `listActiveSuperAdmins` : sélectionne les comptes super actifs non révoqués (`super_admin`, `super_admin_editor`, `super_admin_lector`), sans hash de mot de passe, avec le booléen `hasPassword` (`passwordHash !== null`), ordonnés par rôle puis email.
  - `revokeSuperAdminAccount` : auto-révocation refusée avant la base (`actorId === targetId` -> `self_revocation`) ; step-up par mot de passe avec limiteur de débit (5 essais par 15 min avec identifiant `admin-revocation:<userId>`) ; exécuté dans UNE seule transaction (`tx`) avec verrouillage `for("update").limit(1)` de l'acteur et de la cible ; supprime les sessions de la cible dans `sessions` ; révoque les invitations en attente créées par la cible dans `admin_invitations` (`revokedAt = now` pour les invitations non consommées et non révoquées) ; crée une entrée dans `admin_revocation_audit` conservée 12 mois (`ADMIN_REVOCATION_AUDIT_RETENTION_MONTHS`) ; liste exhaustive des raisons de refus : `self_revocation`, `not_allowed`, `no_password`, `invalid_password`, `rate_limited`, `target_not_found`, `target_already_revoked`, `target_not_allowed`, `insufficient_permissions`.
  - Alertes outbox de révocation (`enqueueAdminRevocationAlerts`, `processAdminRevocationAlertOutbox`) : destinataires = tous les `super_admin` et `super_admin_editor` actifs ; tentatives d'envoi = immédiate, +20 min, +60 min ; bail de traitement = 10 min (`ADMIN_REVOCATION_ALERT_LEASE_MS`) ; rétention = 90 jours (`ADMIN_REVOCATION_ALERT_RETENTION_MS`) ; e-mail d'alerte sans lien ni jeton.
- Page `/admins` (`apps/admin/src/app/admins`) :
  - Protégée par `requireAdminPermission("admins")`, accessible uniquement sur l'hôte `sup-admin`.
  - Affiche la liste des comptes super administrateurs actifs (`listActiveSuperAdmins`) avec badge « Vous » sur son propre compte.
  - Bouton « Révoquer » affiché selon `canRevoke` (calculé par `getAdminRevocationRows`).
  - Message d'avertissement `no_password` (« Définissez un mot de passe pour votre compte avant d'effectuer une révocation. ») affiché et bouton de révocation masqué/bloqué si l'acteur connecté n'a pas de mot de passe.
  - Entrée de menu `Admins` (`id: "admins"`, `href: "/admins"`, `icon: "UserCheck"`, `permission: "admins"`) placée juste après `admin-invitations` dans `ADMIN_MENU_ITEMS`.

### Invitation
- Step-up mot de passe : l'inviteur doit reconfirmer son mot de passe seulement pour inviter un `super_admin_editor`.
- Quota : 10 invitations par heure par inviteur.
- Audit : 12 mois de rétention, lisible par le chef (`super_admin`) seul. Table `admin_invitation_audit`.
- Un seul lien d'invitation en attente par adresse e-mail.
- Jeton : 32 octets aléatoires, haché SHA-256, 48 h de validité, usage unique. Renvoi = invalidation du précédent.
- L'invitation reste conservée dans la table `admin_invitations` même en cas d'échec d'envoi d'e-mail ; la table `admin_invitation_alert_outbox` ne contient que les alertes e-mail.

### Acceptation d'une invitation
- Formulaire : mot de passe saisi deux fois.
- Puis OTP 6 chiffres : 10 min de validité, 5 essais max, renvoi après 60 s, Turnstile sur chaque étape.
- Le compte n'est créé qu'après validation de l'OTP.

### Connexion Google super-admin et invitations (PR 3)
- Flux Google super : sur l'hôte `sup-admin`, le formulaire de connexion propose la connexion Google avec `kind = "super_login"` et un ticket de démarrage (`createAdminSuperLoginOauthStartTicket`).
- Cookie de transaction : `tablino-admin-oauth-tx` transporte l'état et l'identifiant de transaction OAuth sur l'hôte central `auth-admin`.
- Code de transfert : après validation sur l'hôte central, émission d'un code de transfert à usage unique (`createAdminSuperLoginOauthTransferCode`).
- Retour sur l'hôte super : redirection vers `/auth-admin/return` sur `sup-admin`, gérant les flux `flow = "invitation"` ou `flow = "super_login"` pour consommer le code de transfert et initialiser la session Auth.js.
- Page d'erreur neutre (`apps/admin/src/app/auth-admin/error/page.tsx`) : « La connexion a échoué. Recommencez depuis la page de connexion de votre espace d'administration. »
- Journal des refus Google du bloc super : fonction `logSuperAuthRefusal` (`packages/auth/src/index.ts`) qui écrit `console.warn(JSON.stringify({ code }))` ; le retour de `signIn` reste `AUTH_ADMIN_GOOGLE_ERROR_PATH` ; l'écran reste générique, le motif n'est JAMAIS affiché à l'écran.
- Codes des refus Google super (9 codes) :
  - `google_super_user_not_found` : aucun compte trouvé pour l'adresse Google.
  - `google_super_chief_denied` : tentative de connexion Google avec le compte du chef (`super_admin`).
  - `google_super_security_unavailable` : échec de lecture des détails de sécurité ou détails absents.
  - `google_super_revoked` : compte administrateur révoqué (`revokedAt !== null`).
  - `google_super_eligibility_error` : exception levée lors de la vérification d'éligibilité (`checkEligibility`).
  - `google_super_eligibility_denied` : éligibilité refusée (`eligibility.ok` faux).
  - `google_super_transfer_failed` : échec ou absence du code de transfert ou de l'URL de transfert.
  - `google_super_decision_denied` : refus renvoyé par `decideAdminSuperGoogleSignIn`.
  - `google_super_existing_url_failed` : URL de redirection de compte existant absente ou en échec.
- Règle de journalisation : un refus Google ne journalise que le code ; jamais d'e-mail, de `providerAccountId`, d'identifiant utilisateur, de jeton, de `state`, de code OAuth ni de message d'exception. Un échec du journal ne change jamais le retour (`try/catch`).
- Tests unitaires des refus : 9 tests « refus journalisé » dans `packages/auth/tests/admin-super-google-signin.test.ts` prouvent le retour inchangé (`AUTH_ADMIN_GOOGLE_ERROR_PATH`), une seule ligne de journal égale à `{"code":"..."}` et l'absence totale d'e-mail ou d'identifiant dans la sortie journalisée. Le script `test` de `packages/auth/package.json` liste les fichiers à la main et contient déjà ce fichier.
- Précision sur le périmètre : le bloc université de `signIn` n'a PAS de journal à codes (réservé à un lot séparé).

### Proxy et filtrage des chemins par type d'hôte (apps/admin)
- Implémenté via `isAdminProxyPathAllowed(kind, pathname)` dans `apps/admin/src/lib/admin-host.mjs`, où `kind` (`"super" | "central" | "university"`) est le type d'hôte admin résolu et `pathname` le chemin d'URL.
- Hôte central (`kind === "central"`, `auth-admin`) : autorise uniquement `/auth-admin/start`, `/auth-admin/signin`, `/auth-admin/transfer`, `/auth-admin/error`, ainsi que `/api/auth/csrf`, `/api/auth/signin/google` et `/api/auth/callback/google`.
- Hôtes super (`kind === "super"`, `sup-admin`) et université (`kind === "university"`, `{slug}-admin`) : tout chemin sous `/auth-admin/` est strictement refusé SAUF `/auth-admin/return` (correction de la ligne 194, commit `565dd43`).
- Tout chemin refusé par le proxy renvoie une réponse `404` au corps vide.

### Règles de test de bout en bout (E2E)
- Fenêtre normale = `super_admin` (le chef).
- Fenêtre privée = autre compte (`super_admin_editor`, `super_admin_lector` ou `university_admin`).
- Fermer toutes les fenêtres privées avant un rejeu pour purger l'ensemble des cookies de session et de transaction.
- Toujours vérifier l'adresse Google choisie sur l'écran Google pour éviter les erreurs d'association ou de compte inattendu.
- Ne jamais recharger une URL de callback Google (un rejeu provoque l'erreur « State cookie was missing » due à la consommation du jeton/cookie d'état OAuth).

### Navbar par rôle
- Navbar calculée depuis la matrice `admin-permissions` : chaque entrée est filtrée par rôle.
- Chaque rôle voit son rôle écrit.
- Chef (`super_admin`) et editor (`super_admin_editor`) : un lien par section autorisée.
- Lector (`super_admin_lector`) : son rôle et le lien Accueil.

### Outbox d'alertes (migration 0022 et migration 0024)
- Tables persistantes : `admin_invitation_alert_outbox` et `admin_revocation_alert_outbox`.
- Tentatives d'envoi : immédiate, +20 min, +60 min, puis échec définitif.
- Purge : 90 jours. Bail de traitement : 10 min.
- Route interne (`apps/admin/src/app/api/internal/admin-invitation-outbox/route.ts` et `apps/admin/src/lib/admin-invitation-outbox-auth.mjs`) :
  - Protégée par l'en-tête `Authorization: Bearer <ADMIN_INVITATION_OUTBOX_SECRET>` (secret configuré d'au moins 32 caractères, comparé avec `timingSafeEqual`).
  - Traite les DEUX outbox séquentiellement : invitation (`processAdminInvitationAlertOutbox`) puis révocation (`processAdminRevocationAlertOutbox`), l'une ne bloquant pas l'autre.
  - Réponses HTTP : `404` si non autorisé ou si la méthode n'est pas `POST` ; `200` avec corps JSON de compteurs (`{ ...invitation, revocation }`) si `processOutbox` renvoie des données ; `204` si `processOutbox` renvoie `undefined` ; `500` en cas d'exception (si l'un des deux traitements lève une exception, une erreur générique est relancée après avoir tenté les deux).
  - Aucun planificateur automatique pour l'instant.
- Tables créées par la migration 0022 : `admin_invitation_alert_outbox`, `admin_invitation_audit`, `admin_invitation_codes`. Tables créées par la migration 0024 : `admin_revocation_audit`, `admin_revocation_alert_outbox`.

### Réinitialisation de mot de passe admin par hôte (PR #85 / `fix/admin-password-reset-host-scope`)
- Fonction `isUserEligibleForAdminPasswordReset(user: AdminPasswordResetCandidate | null | undefined, host: AdminPasswordResetHost): boolean` dans `packages/db/src/password-reset.ts`.
- Éligibilité par hôte :
  - Hôte super (`sup-admin`) : seuls `super_admin`, `super_admin_editor`, `super_admin_lector` avec `universityId IS NULL`.
  - Hôte université (`{slug}-admin`) : seul `university_admin` dont `universityId` correspond à l'université de l'hôte.
  - Hôte central (`auth-admin`) : personne n'est éligible.
- Critères de compte : rôle et université conformes à l'hôte, `revokedAt` nul, `emailVerified` non nul, `passwordHash` non nul.
- Relecture de la ligne `users` à chaque étape (demande, renvoi, vérification du code, changement de mot de passe, page `/nouveau`).
- Un code émis sur un hôte ne vaut rien sur un autre hôte.
- Un compte révoqué, non vérifié ou sans mot de passe après la demande ne peut pas terminer le flux.
- Réponse identique à un e-mail inconnu (anti-énumération) : cookie `tablino-admin.password-reset` avec identifiant sentinelle `PASSWORD_RESET_UNKNOWN_USER_ID`, même redirection.
- Type `AdminHostContext` (`apps/admin/src/lib/admin-host-context.ts`) est un sous-type strict de `AdminPasswordResetHost` (`packages/db/src/password-reset.ts`) : compatible sans cast.

### Scripts
- `db:diagnose-super-admin` : script de diagnostic du `super_admin` en lecture seule.
- `db:set-super-admin-password` : mise à jour du mot de passe du chef via script gardé.
- `_hidden-password.ts` : saisie masquée réutilisable pour les scripts interactifs.
- `diagnose-admin-google-account.ts` : garde `argv` pour l'adresse e-mail en argument.
- `db:test-admin-invitations` : lecture seule par défaut ; `--apply` écrit des lignes temporaires dans la base de test et exige « OK écriture base ».

### Règles de migration
- `db:migrate` exécute toutes les migrations en attente dans une seule transaction.
- Une valeur d'enum ajoutée par une migration ne peut pas être utilisée dans la même transaction (limitation PostgreSQL) ; RENAME VALUE permis pour un enum.
- `db:generate` crée toujours une NOUVELLE migration ; `drizzle-kit 0.31.11` ne reconnaît pas le renommage de valeurs d'enum : générer, puis corriger seulement le SQL.
- Une migration non appliquée se retire avec `drizzle-kit drop` ; jamais d'édition manuelle de `meta/_journal.json` ni de snapshot.
- Base de test uniquement : aucune migration sur la base de production sans accord explicite.

### Variables d'environnement ajoutées
Noms seulement, aucune valeur :
- `BREVO_API_KEY` — clé d'API Brevo pour l'envoi d'e-mails.
- `BREVO_SENDER_EMAIL` — adresse expéditeur Brevo.
- `ADMIN_HOST_SLUG_MAP` — correspondance slug-hôte pour le routage admin multi-tenant.
- `ADMIN_INVITATION_OUTBOX_SECRET` — secret de la route interne de l'outbox d'alertes.
