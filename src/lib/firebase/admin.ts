import "server-only";
import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function init(): App {
  if (getApps().length) return getApps()[0]!;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return initializeApp({ credential: cert(JSON.parse(json)), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
  }
  // On Firebase App Hosting / Cloud Run, Application Default Credentials are available.
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const app = init();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminBucket = () => getStorage(app).bucket();

// settings() may only be called once per process; guard against dev hot-reload.
const g = globalThis as unknown as { __leafliDbConfigured?: boolean };
if (!g.__leafliDbConfigured) {
  adminDb.settings({ ignoreUndefinedProperties: true });
  g.__leafliDbConfigured = true;
}
