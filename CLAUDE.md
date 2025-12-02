# Claude Code Instructions for MagiManager

## Critical Rule: App Scope Isolation

This is a monorepo with 3 separate apps. **DO NOT cross-contaminate them.**

- When working on **ABRA** (`apps/abra/`), do NOT modify KADABRA or LOGIN
- When working on **KADABRA** (`apps/kadabra/`), do NOT modify ABRA or LOGIN
- When working on **LOGIN** (`apps/login/`), do NOT modify ABRA or KADABRA

**Only modify multiple apps if the user EXPLICITLY requests it.**

If a change seems to require touching another app, ASK the user first before making any changes.

## Critical Rule: ABRA Architecture

ABRA uses a **single `AdminApp` component** from `@magimanager/features`. This is intentional.

**DO NOT create any of these files:**
- `apps/abra/app/admin/layout.tsx`
- `apps/abra/app/admin/accounts/page.tsx`
- `apps/abra/app/admin/team/page.tsx`
- `apps/abra/app/admin/*/page.tsx` (any individual route files)
- Any file that bypasses or replaces AdminApp

**The ONLY allowed admin route file is:**
```
apps/abra/app/admin/[[...path]]/page.tsx
```
This file renders `<AdminApp />` and nothing else. URL routing is handled internally by AdminApp.

To add new views to ABRA:
1. Add the view type to `packages/features/src/admin/admin-ui.tsx`
2. Add path mappings to `VIEW_TO_PATH` and `PATH_TO_VIEW`
3. Add the view component rendering in AdminApp's content area

## App Purposes

- **ABRA** (`apps/abra/`): Account management console - manages ad accounts, identities, team
- **KADABRA** (`apps/kadabra/`): Ads console - Google Ads management, campaigns, AI tools
- **LOGIN** (`apps/login/`): Shared authentication portal

## Shared Packages

- `@magimanager/features`: Shared UI components including AdminApp
- `@magimanager/shared`: Types, validation, utilities
- `@magimanager/core`: Repositories, services, API handlers
- `@magimanager/database`: Prisma client
- `@magimanager/auth`: NextAuth configuration
- `@magimanager/realtime`: Pusher integration
