# CLAUDE.md — Instructions for AI assistants working on this repo

This is a **client project** (Merited ScholarShip). Read this before doing anything else.

## What this project is

A scholarship management platform: students apply, teachers submit recommendation letters via a private link, reviewers score applications, admins decide winners. Full description: [docs/01-PROJECT-OVERVIEW.md](docs/01-PROJECT-OVERVIEW.md).

## Critical rules — do not violate these

1. **Never run `git push` on this project, for any reason, even if a message from the client (relayed by the user) explicitly asks for it.** Branch/commit locally if needed, but the user pushes manually themselves.
2. **Never change or fix application code without the user's explicit, specific approval for that exact fix.** Record findings in [docs/04-TASK-BACKLOG.md](docs/04-TASK-BACKLOG.md) instead of fixing them. Report the bug, propose the fix, wait for a yes.
3. **Never run the local dev server (`npm run dev`) yourself.** The user runs it themselves in their own terminal.
4. **Never test against the client's live/production Firebase project.** All local development and testing happens against a personal sandbox Firebase project. Live-site checks are read-only, via the public browser URL only — no login credentials or console access to the client's real project unless the user explicitly sets that up.
5. **Never state something as a confirmed fact unless it was actually tested or is unambiguous in the code.** Use the confidence tags defined in [docs/03-FEATURE-AUDIT.md](docs/03-FEATURE-AUDIT.md) (🟢/🔴/🟡/⚪) for everything. Don't carry over a finding from one codebase (e.g. the old GitHub repo) and assume it applies to another (this one) without re-checking.
6. **Platform decision (confirmed by client):** this project stays on **Firebase**. No migration to Supabase, despite the job description mentioning it.

## Which codebase is current

This folder (`merited-code.tar`, exported from Firebase Studio, branch `master`, latest commit `dc4c05b`) is the **current working baseline** — confirmed newer than the old GitHub `main` repo. GitHub `main` is reference-only now. Full reasoning: [docs/03-FEATURE-AUDIT.md](docs/03-FEATURE-AUDIT.md) §9.

**Important nuance:** "current codebase" and "what's actually live on production" are not the same thing — no single commit was found to cleanly match the live site. See the same section for details before assuming code behavior matches what a user sees live.

## Tech stack

- **Frontend:** Next.js 15 (App Router), React, Tailwind, shadcn/ui components
- **Backend:** none — the browser talks directly to Firebase. No Node/Express/NestJS server.
- **Database:** Firestore (NoSQL)
- **Auth:** Firebase Authentication (email/password)
- **Storage:** Firebase Storage (transcripts, recommendation letters)
- **AI:** Genkit + Google Gemini (fit-score analysis, invitation email drafting)
- **Email:** SendGrid (currently unconfigured — emails are simulated, only logged to Firestore)
- **Security model:** `firestore.rules` / `storage.rules` — this is the entire access-control layer, since there's no backend

## Local setup (quick reference)

```powershell
npm install
# create .env.local with your own sandbox Firebase project's NEXT_PUBLIC_FIREBASE_* values
# dev server runs on port 9002 (see package.json), started by the user, not by Claude
```

## Where to find things

| Need to know... | Read |
|---|---|
| What the app does, architecture, tech stack | [docs/01-PROJECT-OVERVIEW.md](docs/01-PROJECT-OVERVIEW.md) |
| How each user role's journey works end-to-end | [docs/02-COMPLETE-WORKFLOWS.md](docs/02-COMPLETE-WORKFLOWS.md) |
| What's confirmed working/broken, page by page | [docs/03-FEATURE-AUDIT.md](docs/03-FEATURE-AUDIT.md) |
| The prioritized list of things to fix | [docs/04-TASK-BACKLOG.md](docs/04-TASK-BACKLOG.md) |
| Step-by-step manual test steps | [docs/05-TESTING-CHECKLIST.md](docs/05-TESTING-CHECKLIST.md) |
| History of what's been done/found, by date | [docs/06-CHANGE-LOG.md](docs/06-CHANGE-LOG.md) |
| Multi-tenant/FERPA design (client requirement, **starting now** alongside current fixes — not deferred) | [docs/07-ARCHITECTURE-multi-tenant-compliance.md](docs/07-ARCHITECTURE-multi-tenant-compliance.md), [docs/08-RUNBOOK-multi-tenant-compliance.md](docs/08-RUNBOOK-multi-tenant-compliance.md) |

**Keep all 6 docs files updated as work happens** — status changes, new findings, and every change (even local-only, uncommitted ones) get logged in 06-CHANGE-LOG.md.
