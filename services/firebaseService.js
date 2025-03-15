// services/firebaseService.js
import { initializeApp as initializeAdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp as initializeClientApp } from '@firebase/app';
import { getAuth as getClientAuth } from '@firebase/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the JSON file from the root directory
const firebaseAdminPath = join(dirname(__dirname), 'config', 'firebaseAdmin.json');
let firebaseAdmin;

try {
  const rawData = readFileSync(firebaseAdminPath, 'utf8');
  firebaseAdmin = JSON.parse(rawData);
} catch (error) {
  console.error('Error reading firebaseAdmin.json:', error);
  throw new Error('Failed to load Firebase admin credentials');
}

// ✅ Initialize Firebase Admin SDK (for server-side operations)
initializeAdminApp({
  credential: cert(firebaseAdmin),
});

// ✅ Firebase Client SDK Configuration (for client-side operations)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

// ✅ Initialize Client App for client-side authentication
const clientApp = initializeClientApp(firebaseConfig);
const clientAuthInstance = getClientAuth(clientApp);

// 🚀 Export Admin and Client Auth instances
export const adminAuth = getAdminAuth();       // Server-side admin operations
export { clientAuthInstance };                 // Client-side auth operations