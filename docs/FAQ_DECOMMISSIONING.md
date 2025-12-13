# Decommissioning System FAQ

This FAQ explains how the decommissioning system works, what's needed to set it up, and answers common questions.

---

## Table of Contents

1. [What is Decommissioning?](#what-is-decommissioning)
2. [What Resources Get Cleaned Up?](#what-resources-get-cleaned-up)
3. [Prerequisites & Setup](#prerequisites--setup)
4. [How It Works](#how-it-works)
5. [Trigger Types](#trigger-types)
6. [Appeal Tracking](#appeal-tracking)
7. [Common Questions](#common-questions)

---

## What is Decommissioning?

Decommissioning is the process of **turning off external services** when an identity is no longer in use. This prevents wasted money on unused resources.

### Archive vs Delete

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHIVE vs DELETE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ARCHIVE                          DELETE                       │
│   ═══════                          ══════                       │
│                                                                 │
│   ┌─────────────┐                  ┌─────────────┐             │
│   │  External   │  Turn OFF        │  External   │  Turn OFF   │
│   │  Services   │  ───────►        │  Services   │  ───────►   │
│   │  (Billing)  │  STOP $$$        │  (Billing)  │  STOP $$$   │
│   └─────────────┘                  └─────────────┘             │
│                                                                 │
│   ┌─────────────┐                  ┌─────────────┐             │
│   │  Database   │  KEEP            │  Database   │  REMOVE     │
│   │  Records    │  ───────►        │  Records    │  ───────►   │
│   │             │  (backtrack)     │             │  (permanent)│
│   └─────────────┘                  └─────────────┘             │
│                                                                 │
│   Use when: You might need        Use when: Identity is        │
│   to reference the data later     completely done, no need     │
│                                   to keep any records          │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Resources Get Cleaned Up?

When a decommission job runs, these resources are automatically handled:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RESOURCES CLEANED UP                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐ │
│  │   DigitalOcean   │    │    Namecheap     │    │     GoLogin      │ │
│  │     Droplet      │    │  Auto-Renewal    │    │     Profile      │ │
│  ├──────────────────┤    ├──────────────────┤    ├──────────────────┤ │
│  │                  │    │                  │    │                  │ │
│  │  Cost: $5-12/mo  │    │  Cost: $10-15/yr │    │  Uses license    │ │
│  │                  │    │                  │    │  slot            │ │
│  │  Action: DELETE  │    │  Action: DISABLE │    │  Action: DELETE  │ │
│  │  via DO API      │    │  via NC API      │    │  via GL API      │ │
│  │                  │    │                  │    │                  │ │
│  │  Verify: 404     │    │  Verify: auto-   │    │  Verify: profile │ │
│  │  response        │    │  Renew = false   │    │  not found       │ │
│  │                  │    │                  │    │                  │ │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘ │
│                                                                        │
│  ┌──────────────────┐                                                  │
│  │   Ad Account     │    Note: Domain itself is NOT deleted.          │
│  │                  │    Only auto-renewal is disabled. Domain        │
│  ├──────────────────┤    will expire naturally at renewal date.       │
│  │                  │                                                  │
│  │  Action: ARCHIVE │                                                  │
│  │  in database     │                                                  │
│  │                  │                                                  │
│  │  Verify: status  │                                                  │
│  │  = archived      │                                                  │
│  │                  │                                                  │
│  └──────────────────┘                                                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites & Setup

### Required API Keys

For the decommissioning system to automatically clean up resources, you need these API keys configured in **Settings > Integrations**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUIRED API KEYS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DigitalOcean API Token                                      │
│     ├── Where: Settings > Integrations > DigitalOcean           │
│     ├── Needed for: Deleting droplets                           │
│     └── Get from: https://cloud.digitalocean.com/account/api    │
│                                                                 │
│  2. Namecheap API Credentials                                   │
│     ├── Where: Settings > Integrations > Namecheap              │
│     ├── Needed for: Disabling domain auto-renewal               │
│     ├── Fields: API User, API Key, Username, Client IP          │
│     └── Get from: https://ap.www.namecheap.com/settings/tools/  │
│                   apiaccess/                                    │
│                                                                 │
│  3. GoLogin API Key                                             │
│     ├── Where: Settings > Integrations > GoLogin                │
│     ├── Needed for: Deleting browser profiles                   │
│     └── Get from: GoLogin app settings                          │
│                                                                 │
│  NOTE: If an API key is missing, that specific cleanup step     │
│  will be skipped (marked as "skipped" in job status).           │
│  Other cleanup steps will still proceed.                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Decommission Settings

Configure auto-decommission rules in **Settings > Decommission**:

| Setting | Description | Recommendation |
|---------|-------------|----------------|
| Auto-decommission suspended after | Days before auto-decommission of suspended accounts | 30-60 days |
| Auto-decommission in-appeal after | Days before auto-decommission of accounts in appeal | 60-90 days |
| Auto-decommission inactive after | Days before auto-decommission of inactive identities | 30 days |
| Send reminder before | Days before execution to send reminder | 3-7 days |
| Enable daily digest | Receive daily summary of decommissions | Yes |

**Set to 0 to disable any auto-decommission rule.**

### Telegram Notifications (Optional)

For real-time alerts, configure Telegram in **Settings > Notifications**:
- Bot Token
- Chat ID

---

## How It Works

### Decommission Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DECOMMISSION FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

  TRIGGER                    SCHEDULING                   EXECUTION
  ═══════                    ══════════                   ═════════

  ┌─────────┐               ┌─────────────┐              ┌─────────────┐
  │ Account │               │   Create    │              │   Execute   │
  │ Banned  │──────────────►│ Decommission│─────────────►│   Cleanup   │
  └─────────┘               │    Job      │              │             │
                            └─────────────┘              └──────┬──────┘
  ┌─────────┐                     │                             │
  │ Manual  │─────────────────────┤                             ▼
  │ Request │                     │                      ┌─────────────┐
  └─────────┘                     │                      │  Resource   │
                                  │                      │  Cleanup    │
  ┌─────────┐                     │                      │             │
  │  Auto   │                     │                      │ • Droplet   │
  │ Timeout │─────────────────────┘                      │ • Domain    │
  └─────────┘                                            │ • GoLogin   │
       │                                                 │ • Account   │
       │                                                 └──────┬──────┘
       │                                                        │
       ▼                                                        ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                        NOTIFICATION FLOW                            │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │   Job Created ──► Reminder (X days before) ──► Completed/Failed    │
  │        │                    │                         │             │
  │        ▼                    ▼                         ▼             │
  │   ┌─────────┐         ┌─────────┐              ┌─────────────┐     │
  │   │SCHEDULED│         │REMINDER │              │  COMPLETED  │     │
  │   │ Alert   │         │ Alert   │              │  or FAILED  │     │
  │   └─────────┘         └─────────┘              │   Alert     │     │
  │                                                └─────────────┘     │
  │                                                                     │
  │   Daily Digest: Summary of all pending/completed/failed jobs       │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
```

### Job States

```
┌─────────────────────────────────────────────────────────────────┐
│                       JOB STATES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐      ┌───────────┐      ┌───────────┐            │
│   │ PENDING │─────►│IN_PROGRESS│─────►│ COMPLETED │            │
│   └─────────┘      └───────────┘      └───────────┘            │
│        │                 │                                      │
│        │                 │            ┌───────────┐            │
│        │                 └───────────►│  FAILED   │            │
│        │                              └───────────┘            │
│        │                                    │                   │
│        │                                    │ Retry             │
│        │                                    ▼                   │
│        │                              ┌───────────┐            │
│        │                              │IN_PROGRESS│            │
│        │                              └───────────┘            │
│        │                                                        │
│        │                              ┌───────────┐            │
│        └─────────────────────────────►│ CANCELLED │            │
│               (user cancels)          └───────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Resource Status Tracking

Each resource is tracked individually within a job:

```
┌─────────────────────────────────────────────────────────────────┐
│                   RESOURCE STATUS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Job: dec_abc123                                               │
│   Identity: John Smith                                          │
│   Status: in_progress                                           │
│                                                                 │
│   Resources:                                                    │
│   ┌──────────────┬────────────┬─────────────────────────────┐  │
│   │   Resource   │   Status   │          Details            │  │
│   ├──────────────┼────────────┼─────────────────────────────┤  │
│   │   Droplet    │ completed  │ Deleted, verified 404       │  │
│   │   Domain     │ completed  │ Auto-renew disabled         │  │
│   │   GoLogin    │ pending    │ Waiting to process          │  │
│   │   Account    │ pending    │ Waiting to process          │  │
│   └──────────────┴────────────┴─────────────────────────────┘  │
│                                                                 │
│   Possible statuses per resource:                               │
│   • pending   - Not yet attempted                               │
│   • completed - Successfully cleaned up & verified              │
│   • failed    - Cleanup failed (see error message)              │
│   • skipped   - Resource doesn't exist or API key missing       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Trigger Types

### How Decommissions Get Started

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRIGGER TYPES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. MANUAL                                                      │
│     ├── How: Click "Start Decommission" on identity             │
│     ├── When: Immediate or scheduled                            │
│     └── Who: Any admin user                                     │
│                                                                 │
│  2. BANNED                                                      │
│     ├── How: Set account health to "Banned"                     │
│     ├── When: Job created immediately                           │
│     └── Note: Most urgent - account is permanently gone         │
│                                                                 │
│  3. SUSPENDED_TIMEOUT                                           │
│     ├── How: Account suspended > X days (from settings)         │
│     ├── When: Checked daily by cron job                         │
│     └── Note: Gives time to recover before cleanup              │
│                                                                 │
│  4. APPEAL_TIMEOUT                                              │
│     ├── How: Account in-appeal > Y days (from settings)         │
│     ├── When: Checked daily by cron job                         │
│     └── Note: Appeals taking too long are assumed lost          │
│                                                                 │
│  5. INACTIVE_TIMEOUT                                            │
│     ├── How: Identity marked inactive > Z days (from settings)  │
│     ├── When: Checked daily by cron job                         │
│     └── Note: For identities no longer being used               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appeal Tracking

When an account is set to "in-appeal", the system automatically tracks the appeal process:

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPEAL LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Account Status                                                │
│   Changes to                                                    │
│   "In-Appeal"                                                   │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────┐                                               │
│   │   Appeal    │◄─── Automatically created                     │
│   │  Tracking   │                                               │
│   │   Started   │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐      │
│   │                 DURING APPEAL                        │      │
│   │                                                      │      │
│   │  • Log attempts (form, email, phone, chat)          │      │
│   │  • Set deadline (optional)                          │      │
│   │  • Add notes                                        │      │
│   │  • Track days in appeal                             │      │
│   │                                                      │      │
│   └──────────────────────┬──────────────────────────────┘      │
│                          │                                      │
│          ┌───────────────┼───────────────┐                     │
│          ▼               ▼               ▼                     │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│   │ REINSTATED  │ │   BANNED    │ │  ABANDONED  │              │
│   │             │ │             │ │             │              │
│   │ Account     │ │ Appeal      │ │ User gave   │              │
│   │ restored!   │ │ denied      │ │ up          │              │
│   │ Set to      │ │             │ │             │              │
│   │ "active"    │ │ Triggers    │ │ Triggers    │              │
│   │             │ │ decommission│ │ decommission│              │
│   └─────────────┘ └─────────────┘ └─────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Appeal Methods

When logging appeal attempts, you can specify the method:
- **Form** - Submitted through platform's appeal form
- **Email** - Sent email to support
- **Phone** - Called support line
- **Chat** - Used live chat support

---

## Common Questions

### Q: What happens if an API call fails?

The job will be marked as "failed" with the specific error message. The resource that failed will show "failed" status while others may show "completed" or "pending". You can:
1. Fix the underlying issue (check API key, network, etc.)
2. Click "Retry" to attempt cleanup again

Failed jobs are highlighted in the Decommission Center for easy monitoring.

### Q: Can I cancel a decommission before it runs?

Yes! While a job is in "pending" status, you can click "Cancel" to stop it. Once execution begins, it cannot be cancelled.

### Q: What if I don't have all the API keys?

The system will skip resources that can't be cleaned up due to missing API keys:
- Missing DigitalOcean key? Droplet cleanup skipped
- Missing Namecheap key? Domain auto-renewal stays enabled
- Missing GoLogin key? Profile cleanup skipped

The job will still complete, but those resources need manual cleanup.

### Q: How do I manually clean up failed resources?

1. **Droplet**: Go to DigitalOcean dashboard > Droplets > Delete
2. **Domain**: Go to Namecheap dashboard > Domain List > Manage > Auto-Renew OFF
3. **GoLogin**: Open GoLogin app > Find profile > Delete
4. **Ad Account**: Already in ABRA - set handoff status to "archived"

### Q: What does "verified" mean?

After each cleanup action, the system verifies it worked:
- Droplet: Confirms droplet returns 404 (doesn't exist)
- Domain: Confirms auto-renew setting is false
- GoLogin: Confirms profile no longer exists

This ensures billing actually stops, not just that we sent a request.

### Q: How often do the auto-decommission checks run?

Daily at 4 PM UTC. The cron job:
1. Finds accounts/identities that exceed the configured thresholds
2. Creates decommission jobs with scheduled execution dates
3. Sends notifications about newly scheduled jobs

Execution happens at 5 PM UTC for any jobs whose scheduled date has arrived.

### Q: Can I see what's coming up for auto-decommission?

Yes! In the Decommission Center, click the "Candidates" tab to see:
- Identities approaching auto-decommission thresholds
- Days until they'll be scheduled
- Option to manually start decommission early

### Q: What notifications will I receive?

| Event | In-App | Telegram |
|-------|--------|----------|
| Job Scheduled | Yes | Yes (if configured) |
| Reminder (X days before) | Yes | Yes |
| Completed | Yes | Yes |
| Failed | Yes | Yes (high priority) |
| Daily Digest | Yes | Yes |

### Q: Does archiving an identity trigger decommission?

Yes! When you archive an identity through the UI, the system automatically:
1. Creates a decommission job
2. Cleans up all associated resources
3. Marks the identity as decommissioned

This is the "Archive" action - billing stops but records are kept.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUICK REFERENCE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SETUP CHECKLIST:                                               │
│  □ Configure DigitalOcean API token                             │
│  □ Configure Namecheap API credentials                          │
│  □ Configure GoLogin API key                                    │
│  □ Set auto-decommission thresholds (or 0 to disable)          │
│  □ Set reminder days before execution                           │
│  □ Enable daily digest                                          │
│  □ (Optional) Configure Telegram notifications                  │
│                                                                 │
│  KEY LOCATIONS:                                                 │
│  • Decommission Center: Sidebar > Decommission                  │
│  • Settings: Settings > Decommission tab                        │
│  • API Keys: Settings > Integrations                            │
│  • Appeal Tracking: Identity Detail > Appeal section            │
│                                                                 │
│  ACTIONS:                                                       │
│  • Start Manual: Identity Detail > "Start Decommission"         │
│  • Execute Now: Decommission Center > Pending > Execute         │
│  • Cancel: Decommission Center > Pending > Cancel               │
│  • Retry Failed: Decommission Center > Failed > Retry           │
│                                                                 │
│  CRON SCHEDULE (UTC):                                           │
│  • 4 PM - Check for auto-decommission candidates               │
│  • 5 PM - Execute scheduled decommission jobs                   │
│  • 4 PM - Send daily digest                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [DECOMMISSIONING.md](./DECOMMISSIONING.md) - Technical reference with API endpoints, database models, and service details
