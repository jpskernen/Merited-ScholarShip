# Scholarship App - Developer Guide

This is a Next.js application built with Firebase and Genkit.

## 🌐 Multi-Site Hosting

The project is configured for multiple Firebase Hosting sites:
- **Marketing Site:** Located in `/marketing`. Deployment target: `marketing`.
- **Full Web App:** The Next.js application in `/src`. Deployment target: `app`.

### Deployment
Before deploying for the first time, you must link your targets to your Firebase site IDs:
1. `firebase target:apply hosting marketing <your-marketing-site-id>`
2. `firebase target:apply hosting app <your-app-site-id>`

To deploy specific sites:
- `firebase deploy --only hosting:marketing`
- `firebase deploy --only hosting:app`

## 🚀 Getting Started

1. **Install dependencies:** `npm install`
2. **Run the development server:** `npm run dev`
3. **Open the app:** [http://localhost:9002](http://localhost:9002)

## 🌐 Deployment & Domains (App Hosting)

This project uses **Firebase App Hosting** for the Next.js application.
- Run `firebase deploy --only apphosting`

## 🛠 Debugging Tools

### 1. AI Flows (Genkit)
- Run `npm run genkit:dev` in your terminal.
- Open the Genkit Developer UI at [http://localhost:4000](http://localhost:4000).

### 2. Database & Auth (Firebase)
- Use the [Firebase Console](https://console.firebase.google.com/) to monitor users and data.
