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

## 🗄️ Data Storage Map (Accounts)

User accounts are stored across two Firebase services:

### 1. Firebase Authentication
- **Purpose**: Handles login credentials, password resets, and session tokens.
- **Data**: Email, Password (hashed), and UID (Unique Identifier).

### 2. Cloud Firestore
- **`/users/{uid}`**: The primary profile. Contains `firstName`, `lastName`, and `role`.
- **`/roles_admin/{uid}`**: A secure registry for `Admin` and `Sponsor` roles. Used for database-level security checks.
- **`/reviewers/{uid}`**: A registry for committee members to track assignments and review history.

## 🚀 Core Workflows

### 1. Applicant Workflow
- **Profile Completion**: Students fill out contact info, academic history, and essays.
- **Document Management**: Securely upload PDF/DOCX transcripts and letters of recommendation to Firebase Storage.
- **Tracking**: Real-time status updates as the committee reviews their application.

### 2. Reviewer Workflow
- **Randomized Queue**: Assignments are sorted randomly on the client to reduce order-bias.
- **Evaluation Rubric**: Scoring based on weighted criteria (GPA 25%, Leadership 15%, etc.).
- **AI Assessment**: Uses Genkit + Gemini to analyze the "Fit Score" between student essays and scholarship goals.
- **Recommendation**: Final "Accept" or "Deny" decision for each candidate.

### 3. Administrator Workflow
- **Invite Management**: Generate secure links to onboard new reviewers or fellow admins.
- **Committee Analytics**: View average scores, find outliers (high-variance reviews), and manage shortlists.
- **Scholarship Control**: Full CRUD (Create, Read, Update, Delete) access to the `programs` collection.

## 🤖 Generative AI Integration
- **Analyze Fit**: Compares student profiles against scholarship criteria to provide an objective fit score.
- **Summarize**: Provides high-level summaries of long essays and transcripts for quick reviewer briefing.
