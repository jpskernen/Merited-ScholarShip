# ScholarShip - Architectural Overview

This document summarizes the core logic and workflows of the Scholarship Management Platform.

## 👥 User Roles & Access Control

The system uses a triple-check mechanism to identify user roles via Firestore:
1. **Applicant**: Default role for new signups. Managed in the `users` collection.
2. **Reviewer**: Managed in the `reviewers` collection. Onboarded via admin invitation.
3. **Admin/Sponsor**: Managed in the `roles_admin` collection. High-level privileges to manage the system.

Access is enforced at two levels:
- **Routing**: `src/app/(main)/layout.tsx` redirects users to their appropriate dashboard.
- **Data**: `firestore.rules` and `storage.rules` ensure users only read/write authorized data.

## 🚀 Core Workflows

### 1. Applicant Workflow
- **Profile Completion**: Students fill out contact info, academic history, and essays.
- **Document Management**: Securely upload PDF/DOCX transcripts and letters of recommendation.
- **Tracking**: Real-time status updates as the committee reviews their application.

### 2. Reviewer Workflow
- **Randomized Queue**: Assignments are sorted randomly to reduce order-bias.
- **Evaluation Rubric**: Scoring based on weighted criteria (GPA 25%, Leadership 15%, etc.).
- **AI Assessment**: Uses Genkit + Gemini to analyze the "Fit Score" between student essays and scholarship goals.
- **Recommendation**: Final "Accept" or "Deny" decision for each candidate.

### 3. Administrator Workflow
- **Invite Management**: Generate secure links to onboard new reviewers or other admins.
- **Committee Analytics**: View average scores, find outliers (high-variance reviews), and manage shortlists.
- **Program Control**: Manage the list of available scholarships and criteria.

## 🤖 Generative AI Integration
- **Analyze Fit**: Compares student profiles against scholarship criteria to provide an objective fit score.
- **Summarize**: Provides high-level summaries of long essays and transcripts for quick reviewer briefing.

## 📁 Project Structure
- `src/app/(auth)`: Login, Signup, and secure onboarding flows.
- `src/app/(main)/dashboard`: Applicant-specific portal.
- `src/app/(main)/review`: Reviewer-specific portal.
- `src/app/admin`: Admin-specific portal.
- `src/ai/flows`: Genkit AI logic.
- `src/firebase`: Core SDK initialization and custom hooks.