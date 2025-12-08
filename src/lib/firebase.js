import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBbVxa9eh2JwT124nU-kLH_yF7V8MybimI",
  authDomain: "fingloss-11b6a.firebaseapp.com",
  projectId: "fingloss-11b6a",
  storageBucket: "fingloss-11b6a.firebasestorage.app",
  messagingSenderId: "299026518489",
  appId: "1:299026518489:web:d6f8a4cefb91cb55bd49c8"
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase configuration is incomplete. Please check your Firebase config.');
}

// Initialize Firebase
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  
  // Log successful initialization
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw new Error(`Firebase initialization failed: ${error.message}`);
}

export { db };
export default app;
