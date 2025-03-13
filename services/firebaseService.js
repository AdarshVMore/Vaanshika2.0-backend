// services/firebaseService.js
import { initializeApp as initializeAdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp as initializeClientApp } from '@firebase/app';
import { getAuth as getClientAuth } from '@firebase/auth';
import dotenv from 'dotenv';

dotenv.config();

// Create service account from environment variables
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
};

// ✅ Initialize Firebase Admin SDK (for server-side operations)
initializeAdminApp({
  credential: cert(serviceAccount),
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