# Tablino

Archive numérique de devoirs universitaires — PWA mobile-first.

## Architecture

Monorepo pnpm + Turborepo.

```
apps/
  web/      # Next.js — étudiants, PWA (port 3000)
  admin/    # Next.js — dashboard admin + scanner (port 3001)
packages/
  db/       # Drizzle ORM — schéma PostgreSQL + client
  auth/     # Auth.js v4 — Google OAuth + credentials
```

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Drizzle ORM
- Cloudflare R2 (stockage PDF)
- Auth.js v4 (Google OAuth + email/password)
- Paiement mobile money (CinetPay / PayDunya / Ligdicash)

## Démarrage

```bash
cp .env.example .env.local
# Remplir les variables d'environnement

pnpm install
pnpm db:push     # Appliquer le schéma en dev
pnpm dev         # Lance web (3000) + admin (3001)
```

## Scripts racine

| Commande | Description |
|---|---|
| `pnpm dev` | Lance toutes les apps en dev |
| `pnpm build` | Build production (toutes les apps) |
| `pnpm db:push` | Appliquer le schéma Drizzle |
| `pnpm db:generate` | Générer les migrations |
| `pnpm db:studio` | Interface Drizzle Studio |

## Rôles
- `admin` — gère filières, matières, utilisateurs
- `scanner` — dépose et valide les devoirs
- `student` — consulte et télécharge

## Multi-tenant
- `apps/web` : sous-domaine par université (ex: `iscom.tablino.com`)
- `apps/admin` : domaine unique `admin.tablino.com`, université déterminée par le compte
