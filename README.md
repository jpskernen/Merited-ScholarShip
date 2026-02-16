# Scholarship App - Developer Guide

This is a Next.js application built with Firebase and Genkit.

## 🚀 Getting Started

1. **Install dependencies:** `npm install`
2. **Run the development server:** `npm run dev`
3. **Open the app:** [http://localhost:9002](http://localhost:9002)

## 🌐 Deployment & Domains

### 1. Initial Deployment
To deploy your app to Firebase App Hosting for the first time:
- Run `firebase login`
- Run `firebase use scholarship-hib4j`
- Run `firebase deploy --only apphosting`

### 2. Connecting a Custom Domain
To use your own domain (e.g., `www.scholarships.org`):
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **scholarship-hib4j**.
3. In the left sidebar, navigate to **App Hosting**.
4. Select your app's backend from the list.
5. Click on the **Settings** tab.
6. Scroll down to the **Custom domains** section.
7. Click **Add custom domain** and enter your domain name.
8. Follow the instructions provided to verify ownership and update your DNS records (A and AAAA records) with your domain provider (e.g., GoDaddy, Namecheap, Google Domains).

## 🛠 Debugging Tools

### 1. AI Flows (Genkit)
To debug and test your AI prompts and flows:
- Run `npm run genkit:dev` in your terminal.
- Open the Genkit Developer UI (usually at [http://localhost:4000](http://localhost:4000)).

### 2. Frontend (React)
- Install the **React Developer Tools** extension in Chrome/Firefox.
- This allows you to inspect component state and props.

### 3. Database & Auth (Firebase)
- Use the [Firebase Console](https://console.firebase.google.com/) to:
    - View/Edit Firestore documents.
    - Check Storage security rules.
    - Monitor Authentication users.
