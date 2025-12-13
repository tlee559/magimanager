# Decommissioning System

This document describes the comprehensive decommissioning system in ABRA for managing the cleanup of identity resources when they are no longer in use.

## Overview

When identities are no longer active (due to account bans, suspensions, or becoming inactive), the decommissioning system ensures all associated external resources are properly cleaned up to stop unnecessary billing.

## Key Concepts

| Action | External Services | Database Records |
|--------|------------------|------------------|
| **Archive** | Turn OFF (stop billing) | Keep (for backtracking) |
| **Delete** | Turn OFF (stop billing) | Remove permanently |

## Resources Managed

When a decommission job runs, the following resources are automatically cleaned up:

| Resource | Provider | Action | Verification |
|----------|----------|--------|--------------|
| Droplet | DigitalOcean | DELETE via API | Confirm 404 response |
| Domain Auto-Renewal | Namecheap | Disable via API | Confirm autoRenew=false |
| GoLogin Profile | GoLogin | DELETE via API | Confirm profile removed |
| Ad Account | Internal | Archive in DB | Set handoffStatus=archived |

## Trigger Types

Decommissioning can be triggered by:

1. **Manual** - User initiates decommission from the UI
2. **Banned** - Account is marked as banned
3. **Suspended Timeout** - Account suspended for X days (configurable)
4. **Appeal Timeout** - Account in appeal for X days without resolution
5. **Inactive Timeout** - Identity marked as inactive for X days

## Settings

Configure auto-decommission in **Settings > Decommission**:

| Setting | Description | Default |
|---------|-------------|---------|
| Auto-decommission suspended after | Days before auto-decommission of suspended accounts | 0 (disabled) |
| Auto-decommission in-appeal after | Days before auto-decommission of in-appeal accounts | 0 (disabled) |
| Auto-decommission inactive after | Days before auto-decommission of inactive identities | 0 (disabled) |
| Send reminder before | Days before execution to send reminder | 3 |
| Enable daily digest | Receive daily summary of decommissions | Yes |

## Appeal Tracking

When an account is marked as "in-appeal", the system automatically tracks the appeal:

- **Start Date** - When the appeal began
- **Deadline** - Optional deadline for the appeal
- **Attempts** - Number of appeal attempts made
- **Method** - How the appeal was submitted (form, email, phone, chat)
- **Notes** - User notes about the appeal

### Resolving Appeals

Appeals can be resolved as:
- **Reinstated** - Account restored, set to "active"
- **Banned** - Account permanently banned, triggers decommission
- **Abandoned** - User gave up, triggers decommission

## Decommission Center

Access the Decommission Center from the sidebar (Admin only) to:

1. **View Pending Jobs** - Jobs waiting to be executed
2. **View Completed Jobs** - Successfully decommissioned identities
3. **View Failed Jobs** - Jobs that need manual intervention
4. **View Candidates** - Identities approaching auto-decommission thresholds

### Job States

| State | Description |
|-------|-------------|
| Pending | Scheduled but not yet executed |
| In Progress | Currently executing cleanup |
| Completed | All resources cleaned up successfully |
| Failed | One or more resources failed to clean up |
| Cancelled | User cancelled the job |

## Notifications

The system sends notifications at key points:

| Event | Type | Description |
|-------|------|-------------|
| DECOMMISSION_SCHEDULED | Warning | Job scheduled, execution date set |
| DECOMMISSION_REMINDER | Warning | X days before execution |
| DECOMMISSION_COMPLETED | Success | All resources cleaned up |
| DECOMMISSION_FAILED | Error | Cleanup failed, needs attention |
| APPEAL_DEADLINE_APPROACHING | Warning | Appeal deadline coming up |

Notifications are sent via:
- In-app notifications (bell icon)
- Telegram (if configured in Settings > Notifications)

## API Endpoints

### Decommission Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/decommission` | List all jobs |
| GET | `/api/decommission/candidates` | Get auto-decommission candidates |
| POST | `/api/decommission/start` | Start manual decommission |
| GET | `/api/decommission/[id]` | Get specific job |
| POST | `/api/decommission/[id]/execute` | Execute job now |
| POST | `/api/decommission/[id]/cancel` | Cancel pending job |
| POST | `/api/decommission/[id]/retry` | Retry failed job |

### Appeal Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts/[id]/appeal` | Get appeal tracking |
| PATCH | `/api/accounts/[id]/appeal` | Update notes/deadline |
| POST | `/api/accounts/[id]/appeal/attempt` | Log appeal attempt |
| POST | `/api/accounts/[id]/appeal/resolve` | Resolve appeal |

## Cron Jobs

Automated jobs run daily (configured in `vercel.json`):

| Job | Schedule | Description |
|-----|----------|-------------|
| decommission-check | 4 PM UTC | Check for auto-decommission triggers |
| decommission-execute | 5 PM UTC | Execute scheduled jobs |
| decommission-digest | 4 PM UTC | Send daily digest |

## Resource Cleanup Process

When a decommission job executes:

1. **Droplet Cleanup**
   - Call DigitalOcean API to delete droplet
   - Verify droplet returns 404 (deleted)
   - Update website record (clear dropletId/dropletIp)

2. **Domain Auto-Renewal**
   - Call Namecheap API to disable auto-renewal
   - Verify autoRenew setting is false
   - Log expiration date for reference

3. **GoLogin Profile**
   - Call GoLogin API to delete profile
   - Verify profile no longer exists
   - Remove from database

4. **Ad Account**
   - Set handoffStatus to "archived"
   - Log activity

5. **Identity**
   - Set decommissionedAt timestamp
   - Mark as archived if not already

## Troubleshooting

### Failed Decommission Jobs

If a job fails:
1. Check the error message in the Decommission Center
2. Review which resources failed (shown in resource status)
3. Fix the underlying issue (API key expired, network issue, etc.)
4. Click "Retry" to attempt cleanup again

### Manual Cleanup

If automated cleanup fails, you can manually:
1. Delete the droplet in DigitalOcean dashboard
2. Disable auto-renewal in Namecheap dashboard
3. Delete the profile in GoLogin dashboard
4. Archive the account in ABRA

## Files & Services

| File | Purpose |
|------|---------|
| `packages/core/src/services/decommission.service.ts` | Main service |
| `packages/core/src/services/appeal-tracking.service.ts` | Appeal tracking |
| `packages/core/src/api-handlers/decommission.handler.ts` | API handlers |
| `packages/core/src/api-handlers/appeal.handler.ts` | Appeal API handlers |
| `apps/abra/app/api/decommission/` | API routes |
| `apps/abra/app/api/accounts/[id]/appeal/` | Appeal routes |
| `apps/abra/app/api/cron/` | Cron job routes |
| `packages/features/src/admin/admin-ui.tsx` | UI components |

## Database Models

### DecommissionJob
```prisma
model DecommissionJob {
  id                  String    @id @default(cuid())
  identityProfileId   String    @unique
  triggerType         String    // manual, banned, suspended_timeout, appeal_timeout, inactive_timeout
  triggeredBy         String?   // User ID if manual
  triggeredAt         DateTime  @default(now())
  jobType             String    @default("archive") // archive or delete
  status              String    @default("pending") // pending, in_progress, completed, failed, cancelled
  completedAt         DateTime?
  resourceStatus      String    @db.Text // JSON: {"droplet":"pending","domain":"pending",...}
  errorMessage        String?   @db.Text
  scheduledFor        DateTime?
  reminderSentAt      DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

### AppealTracking
```prisma
model AppealTracking {
  id                String    @id @default(cuid())
  adAccountId       String    @unique
  appealStartDate   DateTime  @default(now())
  appealDeadline    DateTime?
  appealAttempts    Int       @default(1)
  appealNotes       String?   @db.Text
  lastAppealDate    DateTime?
  lastAppealMethod  String?   // form, email, phone, chat
  resolvedAt        DateTime?
  resolution        String?   // reinstated, banned, abandoned
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

## Best Practices

1. **Set reasonable timeouts** - Don't set auto-decommission days too low; give time for appeal resolution
2. **Use reminders** - Set reminder days to give yourself time to cancel if needed
3. **Enable daily digest** - Stay informed about pending decommissions
4. **Review candidates** - Check the Candidates tab regularly
5. **Configure Telegram** - For immediate alerts on critical issues
