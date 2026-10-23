"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { disableNetwork, enableNetwork, getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db: Firestore = (() => {
  try {
    // Fall back to long-polling when streaming is blocked or flaky (VPNs, proxies, QUIC timeouts).
    return initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(firebaseApp); // already initialised (hot reload)
  }
})();

// While the device is offline, pause Firestore instead of letting it retry in a loop;
// live listeners keep serving cached data and resume when the connection returns.
if (typeof window !== "undefined") {
  window.addEventListener("offline", () => void disableNetwork(db).catch(() => {}));
  window.addEventListener("online", () => void enableNetwork(db).catch(() => {}));
}
export const storage = getStorage(firebaseApp);
