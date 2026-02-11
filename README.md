# Scholarship App - Developer Guide

This is a Next.js application built with Firebase and Genkit.

## 🚀 Getting Started

1. **Install dependencies:** `npm install`
2. **Run the development server:** `npm run dev`
3. **Open the app:** [http://localhost:9002](http://localhost:9002)

## 🛠 Debugging Tools

### 1. AI Flows (Genkit)
To debug and test your AI prompts and flows:
- Run `npm run genkit:dev` in your terminal.
- Open the Genkit Developer UI (usually at [http://localhost:4000](http://localhost:4000)).
- This allows you to step through LLM calls and inspect inputs/outputs.

### 2. Frontend (React)
- Install the **React Developer Tools** extension in Chrome/Firefox.
- This allows you to inspect component state (like the `isSaving` state in your profile form).

### 3. Database & Auth (Firebase)
- Use the [Firebase Console](https://console.firebase.google.com/) to:
    - View/Edit Firestore documents.
    - Check Storage security rules.
    - Monitor Authentication users.

### 4. Server Logs
- Check the terminal where you ran `npm run dev` for server-side errors (Node.js/Next.js).
- Check the browser's Developer Tools (F12) for client-side errors and network requests.

## 🌐 Deployment
To go live:
1. `firebase login`
2. `firebase use scholarship-hib4j`
3. `firebase deploy --only apphosting`
