import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAJvJnWwvduJPxPp_hCFQ_VE7j6DpwFE-0",
  authDomain: "peer-chat-123.firebaseapp.com",
  projectId: "peer-chat-123",
  storageBucket: "peer-chat-123.firebasestorage.app",
  messagingSenderId: "969305957975",
  appId: "1:969305957975:web:1dffe6d40f1d2e5a9f2512",
  measurementId: "G-9ZHY7803J2",
  databaseURL: "https://peer-chat-123-default-rtdb.firebaseio.com/"
};

import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const rtdb = getDatabase(app);

export const googleProvider = new GoogleAuthProvider();

// Where Firebase should send the user after they click the password
// reset link in their email. Point it at a route in THIS app so the
// reset happens inside our own UI instead of Firebase's hosted page.
export const actionCodeSettings = {
  url: `${window.location.origin}${window.location.pathname}#/reset-password`,
  handleCodeInApp: true,
};