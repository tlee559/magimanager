# MagiManager

A monorepo containing two Next.js applications for Google Ads account management.

## Applications

| App | Description | Local Port | Production URL |
|-----|-------------|------------|----------------|
| **ABRA** | Admin Portal - Super admin dashboard for system management | 3000 | https://abra.magimanager.com |
| **KADABRA** | Media Buyer Portal - Day-to-day ad account management | 3001 | https://magimanager.com |

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS
- **Monorepo**: Turborepo with npm workspaces
- **Deployment**: Vercel

## Project Structure

```
magimanager-main/
├── apps/
│   ├── abra/                 # Admin Portal (Super Admin)
│   └── kadabra/              # Media Buyer Portal
├── packages/
│   ├── auth/                 # Shared authentication logic
│   ├── core/                 # Core business logic
│   ├── database/             # Prisma schema & client
│   ├── features/             # Shared feature components
│   ├── realtime/             # Real-time functionality (Pusher)
│   ├── shared/               # Shared utilities
│   └── ui/                   # Shared UI components
├── package.json              # Root package.json
├── turbo.json                # Turborepo configuration
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or Supabase)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/tlee559/magimanager.git
cd magimanager

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate
```

### Environment Setup

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/magimanager?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/magimanager?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3001"

# API Keys
GEMINI_API_KEY="your-gemini-api-key"

# Google Ads OAuth
GOOGLE_ADS_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_ADS_CLIENT_SECRET="your-client-secret"
GOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"

# Token Encryption (generate with: openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY="your-64-char-hex-key"

# Optional: Telegram Notifications
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_CHAT_ID="your-chat-id"
```

### Database Setup

```bash
# Push schema to database
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio
```

### Running Locally

```bash
# Run both apps concurrently
npm run dev

# Run only ABRA (Admin Portal)
npm run dev --filter=abra

# Run only KADABRA (Media Buyer Portal)
npm run dev --filter=kadabra
```

- ABRA: http://localhost:3000
- KADABRA: http://localhost:3001

## Deployment

### Vercel Setup

Both apps are deployed to Vercel from the same repository:

| Vercel Project | App | Root Directory |
|----------------|-----|----------------|
| magimanager-internal | ABRA | `apps/abra` |
| magimanager-saas | KADABRA | `apps/kadabra` |

### Environment Variables (Vercel)

Set these in each Vercel project (Settings → Environment Variables):

```
DATABASE_URL=postgres://...pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgres://...pooler.supabase.com:5432/postgres
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://your-domain.com
GEMINI_API_KEY=your-key
GOOGLE_ADS_CLIENT_ID=your-client-id
GOOGLE_ADS_CLIENT_SECRET=your-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-token
TOKEN_ENCRYPTION_KEY=your-encryption-key
```

**Note**: `NEXTAUTH_URL` should be:
- ABRA: `https://abra.magimanager.com`
- KADABRA: `https://magimanager.com`

### Independent Deployments

Each app is configured to only rebuild when its files change:

- Changes to `apps/abra/` → Only ABRA rebuilds
- Changes to `apps/kadabra/` → Only KADABRA rebuilds
- Changes to `packages/` → Both apps rebuild (manual redeploy needed)

This is configured via Vercel's "Ignored Build Step" setting:
- ABRA: `git diff HEAD^ HEAD --quiet -- ./apps/abra`
- KADABRA: `git diff HEAD^ HEAD --quiet -- ./apps/kadabra`

### Google OAuth Configuration

In Google Cloud Console, add these authorized redirect URIs:

**JavaScript Origins:**
```
http://localhost:3000
http://localhost:3001
https://abra.magimanager.com
https://magimanager.com
```

**Redirect URIs:**
```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/google-ads/callback
http://localhost:3001/api/auth/callback/google
http://localhost:3001/api/auth/google-ads/callback
https://abra.magimanager.com/api/auth/callback/google
https://abra.magimanager.com/api/auth/google-ads/callback
https://magimanager.com/api/auth/callback/google
https://magimanager.com/api/auth/google-ads/callback
```

## Available Scripts

```bash
# Development
npm run dev              # Run all apps
npm run build            # Build all apps
npm run lint             # Lint all apps

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio

# Individual apps
npm run dev --filter=abra
npm run dev --filter=kadabra
```

## Database Schema

The Prisma schema is located at `packages/database/prisma/schema.prisma`.

Key models:
- `User` - Application users with roles (SUPER_ADMIN, ADMIN, MEDIA_BUYER)
- `AdAccount` - Google Ads accounts
- `GoogleAdsConnection` - OAuth connections to Google Ads
- `IdentityProfile` - Identity profiles for ad accounts
- `GoLoginProfile` - Browser profiles for account management
- `AccountActivity` - Activity log for accounts

## Architecture

### Shared Packages

- **@magimanager/database**: Prisma client and schema
- **@magimanager/auth**: NextAuth configuration and utilities
- **@magimanager/core**: Core business logic and services
- **@magimanager/features**: Shared feature components
- **@magimanager/shared**: Utility functions and types
- **@magimanager/ui**: Shared UI components
- **@magimanager/realtime**: Pusher real-time functionality

### Import Example

```typescript
import { prisma } from "@magimanager/database";
import { authOptions } from "@magimanager/auth";
import { cn } from "@magimanager/shared";
```

## Troubleshooting

### Prisma Client Not Generated

```bash
cd packages/database
npx prisma generate
```

### Database Connection Issues

1. Check `DATABASE_URL` and `DIRECT_URL` are correct
2. For Supabase, use the pooler URL (port 6543) for `DATABASE_URL`
3. Use direct connection (port 5432) for `DIRECT_URL`

### Build Failures on Vercel

1. Ensure `postinstall` script exists in `packages/database/package.json`
2. Check that all environment variables are set in Vercel
3. Verify the Root Directory is set correctly (`apps/abra` or `apps/kadabra`)

### TypeScript Errors

```bash
# Regenerate Prisma types
npm run db:generate

# Clear Next.js cache
rm -rf apps/abra/.next apps/kadabra/.next
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test locally with `npm run dev`
4. Push to GitHub - Vercel will auto-deploy

## License

Private - All rights reserved
