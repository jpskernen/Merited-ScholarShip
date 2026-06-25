# ScholarShip - Management Platform

Empowering students through academic opportunities and streamlined committee review.

## 🚀 Getting Started

### 1. Local Development
1. **Clone & Install**:
   ```bash
   npm install
   ```
2. **Environment Setup**:
   Copy `.env.example` to `.env.local` and populate it with your Firebase configuration.
   ```bash
   cp .env.example .env.local
   ```
3. **Run Dev Server**:
   ```bash
   npm run dev
   ```
4. **Local Emulators** (Optional for testing backend rules):
   ```bash
   firebase emulators:start
   ```

### 2. Deployment
This project is optimized for **Firebase App Hosting**.
1. **Build Check**: Our build process automatically validates that all environment variables are set.
2. **Deploy**:
   ```bash
   npm run build
   && firebase deploy
   ```

## 🛠 Administrative Tasks

### Adding a New Scholarship
1. Access the **Admin Panel** at `/admin/scholarships`.
2. Click **"Add New Scholarship"**.
3. Define the **Scoring Rubric**: Set criteria (e.g., GPA, Leadership) and ensure total weight equals 100%.
4. **Assign Reviewers**: Select authorized committee members who should have access to these applications.

### Testing Deadline Reminders
To manually trigger the `deadlineReminder` Cloud Function for testing:
1. Open the Firebase Functions shell:
   ```bash
   firebase functions:shell
   ```
2. Invoke the function:
   ```javascript
   deadlineReminder()
   ```

## 🤖 Generative AI (Genkit)
- Start the Genkit Developer UI: `npm run genkit:dev`
- Current flows:
  - `analyzeScholarshipFit`: Evaluation fit score generation.
  - `generateInvitationEmail`: Secure recruiter/admin onboarding.
  - `summarizeApplication`: Fast briefings for long essays.

## 👥 User Roles
- **Applicant**: Student portal for profile building.
- **Reviewer**: Committee workspace for scoring assigned portfolios.
- **Admin**: System-wide control over programs, audits, and permissions.
