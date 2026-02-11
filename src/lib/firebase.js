import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAjOyPhO_wNkf2XN_IYc3RO_0A3pHrMcKY",
  authDomain: "wflitgloss.firebaseapp.com",
  projectId: "wflitgloss",
  storageBucket: "wflitgloss.firebasestorage.app",
  messagingSenderId: "328667674464",
  appId: "1:328667674464:web:33ed99281c32dba6005005",
  measurementId: "G-6PKHP3E0R4"
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase configuration is incomplete. Please check your Firebase config.');
}

// Initialize Firebase
let app;
let db;
let storage;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Log successful initialization
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw new Error(`Firebase initialization failed: ${error.message}`);
}

export { db, storage };
export default app;
