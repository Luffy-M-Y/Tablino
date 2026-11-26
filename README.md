# Tablino

Archive numérique de cours et de devoirs universitaires, une université par sous-domaine. PWA mobile d'abord.

Règles de travail et état du projet : [`rules/AGENTS.md`](rules/AGENTS.md).

## Architecture

Monorepo pnpm + Turborepo.

```
apps/
  web/        # Next.js : étudiants, PWA (port 3000)
  admin/      # Next.js : administration, upload, scanner OCR (port 3001)
packages/
  auth/       # next-auth v4 (Google + mot de passe), Turnstile, jetons, cookies
  db/         # Drizzle ORM : schéma PostgreSQL, migrations, accès aux données
  email/      # Envoi d'e-mails (Brevo)
  storage/    # Cloudflare R2 : dépôt, suppression, liens signés
```

## Stack

- Next.js 16.4.6 (App Router), React 19, TypeScript, Tailwind CSS
- PostgreSQL (Supabase) + Drizzle ORM
- Cloudflare R2 (fichiers), Cloudflare Turnstile (anti-robot)
- next-auth v4 : Google OAuth et mot de passe
- Brevo (e-mails)
- Tesseract.js (OCR du scanner, servi en local depuis `apps/admin/public/tesseract`)
- Paiement : pas encore intégré

## Rôles

- `super_admin` : chef de la plateforme, compte unique
- `super_admin_editor`, `super_admin_lector` : équipe de la plateforme (modification, lecture)
- `university_admin` : administre une université (structure, fichiers, codes d'accès)
- `student` : consulte et télécharge

Matrice des droits : `apps/admin/src/lib/admin-permissions.mjs`.

## Hôtes

- Étudiants : `{slug}.{ROOT_DOMAIN}` (ex. `iscom.localhost:3000` en local)
- Admin d'université : `{slug}-admin.{ADMIN_ROOT_DOMAIN}`
- Équipe de la plateforme : `sup-admin.{ADMIN_ROOT_DOMAIN}`
- Connexion Google centrale : `AUTH_CENTRAL_HOST` (web), `AUTH_ADMIN_CENTRAL_HOST` (admin)

## Démarrage local

```bash
pnpm install
# Créer apps/web/.env.local et apps/admin/.env.local à partir de .env.example
# (variables R2 en plus : R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)
pnpm --filter @tablino/web dev     # port 3000
pnpm --filter @tablino/admin dev   # port 3001
```

Migrations : `pnpm --filter @tablino/db run db:generate` crée une migration à partir du schéma ; `db:migrate` l'applique. `db:push` et `db:studio` sont désactivés volontairement.

## Vérifications

```bash
pnpm --filter @tablino/<projet> exec tsc --noEmit   # db, auth, admin, web
pnpm --filter @tablino/<projet> test                # db, auth, admin, web, email, storage
pnpm --filter @tablino/<projet> build               # web, admin
```
