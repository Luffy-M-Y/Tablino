# Tablino

Archive numérique de devoirs universitaires — PWA mobile-first.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Drizzle ORM
- Cloudflare R2 (stockage PDF)
- Auth.js v4 (Google OAuth + email/password)
- Paiement mobile money (CinetPay / PayDunya / Ligdicash)

## Démarrage

```bash
cp .env.example .env.local
# Remplir les variables d'environnement

npm install
npm run db:push   # Appliquer le schéma en dev
npm run dev
```

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run db:generate` | Générer les migrations Drizzle |
| `npm run db:push` | Appliquer le schéma (dev) |
| `npm run db:studio` | Interface Drizzle Studio |

## Rôles
- `admin` — gère filières, matières, utilisateurs
- `scanner` — dépose et valide les devoirs
- `student` — consulte et télécharge
