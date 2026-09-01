
/**
 * Firebase Client Configuration
 * Uses NEXT_PUBLIC_ environment variables for security and Next.js compatibility.
 * Includes fallback values for the current project environment.
 */
export const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "scholarship-hib4j",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:345364291560:web:5a490f54f942c3e29b4e5d",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyADX4nU03cEdfHuohhEIXmRjnvomVULXEE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "scholarship-hib4j.firebaseapp.com",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "scholarship-hib4j.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "345364291560",
};
