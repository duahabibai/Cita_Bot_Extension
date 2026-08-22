import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve("./firebase-applet-config.json"), "utf8"),
);

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);

// Suppress benign Firestore gRPC idle stream disconnect warnings
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function isFirestoreIdleWarning(args: any[]) {
  const str = args.map((a: any) => String(a)).join(" ");
  return str.includes("CANCELLED: Disconnecting idle stream") || str.includes("Timed out waiting for new targets");
}

console.error = function (...args) {
  if (isFirestoreIdleWarning(args)) return;
  originalConsoleError.apply(console, args);
};

console.warn = function (...args) {
  if (isFirestoreIdleWarning(args)) return;
  originalConsoleWarn.apply(console, args);
};
