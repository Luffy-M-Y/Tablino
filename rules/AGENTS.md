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
- Base de test autorisée : référence `xblapziuxietpjqewkwh` uniquement. Références interdites : `dmkhqphgxmgsgosvrylx` et `dfrlsuhllzqsqerqzsch`. Vérifier référence et port avant toute opération.
- Base de test xblapziuxietpjqewkwh conservée jusqu'à la fin de la phase de développement. Suppression à la demande de l'utilisateur seulement.
- Tables : universities, programs, levels, academic_years, subjects, resources (cours), assignments (devoirs), users, accounts, sessions, verification_tokens, subscriptions.
- Isolation : clés étrangères composites incluant `university_id`. Test : `db:test-isolation` (8 cas, doit rester vert).
- Statut stocké : `draft` ou `published`. Le statut « disponible / à rendre / expiré » d'un devoir se calcule depuis l'échéance, jamais stocké.
- Année académique : globale à l'université, liée via `subjects.academic_year_id`.
- Migrations : uniquement `pnpm db:generate` puis `pnpm db:migrate`. Jamais `db:push`, jamais de SQL exécuté directement ni depuis le tableau de bord Supabase. Le suivi Drizzle doit rester cohérent avec la base.
- Seed : idempotent (UUID fixes), données marquées « DÉMO », rien de réel. Pour les cycles (id généré par la migration), upsert sur `(university_id, short_code)`, relire l'id pour les enfants.
- `levels.order` : conservé NOT NULL dans la migration 0003. Sera supprimé dans une migration ultérieure (`feat/admin-structure`). Le seed et tout script d'insertion doivent le renseigner.

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

## Sécurité
- Aucun secret, URL de connexion ni clé dans le code, les commits, les captures ou les réponses. Les fichiers `.env*` ne doivent jamais apparaître dans une capture. Ils sont ignorés par Git : vérifier avec `git status` avant chaque commit.
- `UNIVERSITY_ID` : variable serveur uniquement, jamais préfixée `NEXT_PUBLIC_`. Point d'entrée unique : `getCurrentUniversityId()`, à remplacer plus tard par l'identification par sous-domaine.
- Toute requête filtre par `university_id`. Contenu public : uniquement `status = published`.
- RLS Supabase : à activer sur toutes les tables du schéma public, sans politique (l'application utilise la connexion Postgres directe).
- Clés d'API : côté serveur uniquement.

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

## Fonctionnalités prévues (ne pas implémenter sans demande)
- Authentification : Google OAuth + email/mot de passe en secours. Rôles : super_admin (à ajouter), admin, scanner, student. Google refuse les URI de redirection avec wildcard : domaine d'authentification central, cookie de domaine, validation de `callbackUrl` contre une liste autorisée.
- Paiement : mobile money (Orange Money, Moov Money) via agrégateur (CinetPay, PayDunya ou Ligdicash), interface d'abstraction, pas de renouvellement automatique : abonnement par période avec date d'expiration, webhook vérifié côté serveur.
- Scan (dashboard) : caméra multi-pages, redressement, PDF, OCR (Tesseract), validation avant publication.
- Remise de devoirs par les étudiants : interdite sans validation préalable.

## Feuille de route
1. `feat/web-navigation` : design, layout, accueil, fil d'Ariane, pages filières, niveaux, années, matières, listes finales
2. `feat/auth-roles`
3. `feat/admin-structure`
4. `feat/admin-upload` (R2)
5. `feat/admin-scan`
6. `feat/payments`
7. `feat/pwa`
8. `feat/auth-subdomain`

## État d'avancement (à mettre à jour après chaque branche)
- Fait : monorepo, schéma hiérarchique, migrations 0000 à 0002, seed idempotent (UUID fixes), test d'isolation 8/8 — commités sur `feat/db-levels-slug`.
- Fait : RLS (migration 0002), push + PR de `feat/db-levels-slug` vers `develop` — fusionné.
- Fait : `feat/web-navigation` — navigation Filière→Niveau→Année→Matière→Ressources|Devoirs. Push + PR vers `develop` — fusionné.
- Fait sur `feat/db-cycles` : schéma `cycles`, `program_cycles` et `levels.cycle_id` / `year_number` ; migration `0003_colorful_franklin_richards.sql` ; seed idempotent des cycles ; pages cours/devoirs groupées par cycle ; garde transactionnel `canReduceYearsCount` dans `packages/db/src/cycles.ts`.
- Migration 0003 appliquée et vérifiée sur la base de test autorisée. Garde testé sur cette base : 6 cas conformes.
- Vérifications locales : `pnpm build` et `pnpm exec tsc --noEmit` réussis pour les étapes web et db.
- Reste pour `feat/db-cycles` : push de la branche et PR vers `develop` (après autorisation).
- À faire ensuite dans `feat/admin-structure` : supprimer `levels.order` et étendre le garde pour verrouiller aussi les changements de `year_number` d'un niveau existant.
- En attente : domaine `tablino.com`, compte Cloudflare R2, accord de l'ISCOM pour le pilote, rotation des mots de passe Supabase.
