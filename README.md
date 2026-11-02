# ScholarShip — Scholarship Management Platform

Student applications, recommendation letters and committee review, in one place.

Built with Next.js 15 (App Router, server actions), Firebase (Auth, Firestore, Storage) and
Genkit for the AI fit assessment. The app needs a running server — it is **not** a static site.


---

## 1. Running it locally

**Requirements:** Node.js 20+, npm, the Firebase CLI (`npm i -g firebase-tools`).


```bash
npm install
cp .env.example .env     # then fill in the values — see section 2
npm run dev              # http://localhost:9002
```

Other useful commands:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 9002 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run genkit:dev` | Genkit developer UI for the AI flows |
| `firebase emulators:start` | Local Firestore + Storage emulators |

---

## 2. Environment variables

Copy `.env.example` to `.env` and fill it in. The file is gitignored — never commit real values.
In production these are set as secrets in the Firebase App Hosting backend, **not** in `.env`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web config (Project Settings → General) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | " |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | " |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket that uploaded PDFs go to |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | " |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | " |
| `NEXT_PUBLIC_DEFAULT_ORG_ID` |  scholarship-hib4j - The first/main organization (`scholarship-hib4j`). New sign-ups join it and its scholarships show publicly.
| `NEXT_PUBLIC_APP_URL` | Public site URL, used for the links and buttons in outbound email |
| `FIREBASE_PROJECT_ID` | Admin SDK service account (Project Settings → Service Accounts → Generate New Private Key) |
| `FIREBASE_CLIENT_EMAIL` | " |
| `FIREBASE_PRIVATE_KEY` | " — keep the literal `\n` sequences from the downloaded JSON |
| `STORAGE_FIREBASE_PROJECT_ID` | Second service account, only needed while uploads live in a different project from Auth/Firestore  |
| `STORAGE_FIREBASE_CLIENT_EMAIL` | " |
| `STORAGE_FIREBASE_PRIVATE_KEY` | " |
| `GMAIL_USER` | Gmail address that sends notifications |
| `GMAIL_APP_PASSWORD` | 16-character App Password (needs 2FA on that account) |
| `GMAIL_FROM_EMAIL` | From address, if different from `GMAIL_USER` |
| `GEMINI_API_KEY` | Google AI key for the AI fit assessment |

---

## 3. Deploying

Deployment is **Firebase App Hosting**, not static Firebase Hosting. Use the same Firebase
project for hosting, Auth, Firestore and Storage.

1. **Enable the Blaze plan** on the Firebase project (App Hosting and Storage both require it),
   and enable Cloud Storage.
2. **Create the App Hosting backend:** Firebase Console → Build → App Hosting → connect the
   GitHub repository and pick the branch to deploy from. Next.js is detected automatically.
3. **Add the secrets:** in the backend's settings, add every variable from section 2.
   Check `apphosting.yaml` as well — it currently declares only the public Firebase values
   and some stale SendGrid placeholders, and `maxInstances` is 1. Server actions will fail
   until the Gmail, Gemini and Admin SDK secrets are present.
4. **Deploy rules and indexes** once from your machine:
   ```bash
   firebase use <your-project-id>
   firebase deploy --only firestore:rules,firestore:indexes,storage:rules
   ```

   **Or do it by hand in the console** — same result, useful if you'd rather not install the
   CLI:
   - **Firestore rules:** Firebase Console → Firestore Database → Rules. Paste the contents of
     `firestore.rules` over what's there and click **Publish**.
   - **Storage rules:** Firebase Console → Storage → Rules. Paste `storage.rules` and
     **Publish**.
   - **Indexes:** Firestore Database → Indexes → Composite → Add index, and recreate each
     entry listed in `firestore.indexes.json` (collection, fields and sort order). Easier
     alternative: use the app until a query fails — the error in the browser console carries a
     direct link that creates the right index in one click.

   Whichever way you do it, the files in the repo stay the source of truth: if you edit rules
   in the console, copy the change back into the repo so the next deploy doesn't overwrite it.
5. **Done.** Every push to the connected branch now builds and deploys automatically.

Project aliases live in `.firebaserc`; rules, indexes and emulator ports in `firebase.json`.

---

## 4. Setup and data scripts

All in `scripts/`, run with `node scripts/<name>.js`. Each prints what it would do and only
writes when you pass `--apply`. The seed and truncate scripts refuse to run against the live
project unless `ALLOW_LIVE=1` is set.

| Script | When you need it |
|---|---|
| `migrate-org-ids.js` | Once, if you carry existing data over — tags older records with an organization ID |
| `backfill-claims.js` | Once — writes user roles onto login tokens for accounts created before roles existed. Also sets the first platform admin: `node scripts/backfill-claims.js --apply --platform-admin you@example.com` |
| `seed-dummy-data.js` | Test data: one scholarship and one student, for the end-to-end checklist |
| `truncate-db.js` | Clears test data. Note it treats `admin@test.com` as the protected account — change that line if you rename it |

---

## 5. Project layout

```
src/app/            Next.js routes: (main) student, admin, reviewer, recommend
src/app/lib/        Email sending and templates
src/firebase/       Client SDK provider and Admin SDK setup
src/lib/            Server-only helpers (storage, auth, org, platform, legal)
src/ai/             Genkit flows (AI fit assessment)
firestore.rules     Firestore security rules — org-isolated
storage.rules       Storage security rules
firestore.indexes.json
tests/              Rules tests (need Java) and unit tests
docs/               Architecture, runbook, change log and the open-task list
scripts/            Migration and test-data scripts
```

**User roles:** Applicant (student), Recommender (teacher, link-based, no account),
Reviewer (scores assigned applications), Organization Admin, Platform Admin.

---


