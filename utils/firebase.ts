import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, child, push, Database } from 'firebase/database';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let firebaseApp: FirebaseApp;
let database: Database | null = null;
let auth: Auth | null = null;

try {
  firebaseApp = initializeApp(firebaseConfig);
  database = getDatabase(firebaseApp);
  auth = getAuth(firebaseApp);
} catch (error) {
  console.error('Firebase initialization error', error);
}

// Sign in anonymously
export const signInAnonymouslyWithFirebase = async () => {
  try {
    if (!auth) return null;
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error('Anonymous auth error:', error);
    return null;
  }
};

// Room management functions
export const createRoom = async () => {
  try {
    if (!database || !auth?.currentUser) return null;
    
    // Generate a 6-character room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create room in database
    const roomRef = ref(database, `rooms/${roomCode}`);
    await set(roomRef, {
      createdAt: Date.now(),
      createdBy: auth.currentUser.uid,
      participants: {
        [auth.currentUser.uid]: {
          joinedAt: Date.now(),
          isActive: true,
        }
      }
    });
    
    return roomCode;
  } catch (error) {
    console.error('Error creating room:', error);
    return null;
  }
};

export const joinRoom = async (roomCode: string) => {
  try {
    if (!database || !auth?.currentUser) return false;
    
    // Check if room exists
    const roomRef = ref(database, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);
    
    if (!snapshot.exists()) {
      return false;
    }
    
    // Join room
    const participantRef = ref(database, `rooms/${roomCode}/participants/${auth.currentUser.uid}`);
    await set(participantRef, {
      joinedAt: Date.now(),
      isActive: true,
    });
    
    return true;
  } catch (error) {
    console.error('Error joining room:', error);
    return false;
  }
};

export const listenToRoomData = (roomCode: string, callback: (data: any) => void) => {
  if (!database) return () => {};
  
  const roomRef = ref(database, `rooms/${roomCode}`);
  const unsubscribe = onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });
  
  return unsubscribe;
};

export const updateTranscript = async (roomCode: string, originalText: string, translatedText: string, language: string) => {
  try {
    if (!database || !auth?.currentUser) return false;
    
    const transcriptRef = ref(database, `rooms/${roomCode}/transcripts/${Date.now()}`);
    await set(transcriptRef, {
      uid: auth.currentUser.uid,
      timestamp: Date.now(),
      originalText,
      translatedText,
      language,
    });
    
    return true;
  } catch (error) {
    console.error('Error updating transcript:', error);
    return false;
  }
};

export const listenToTranscripts = (roomCode: string, callback: (transcripts: any[]) => void) => {
  if (!database) return () => {};
  
  const transcriptsRef = ref(database, `rooms/${roomCode}/transcripts`);
  const unsubscribe = onValue(transcriptsRef, (snapshot) => {
    const data = snapshot.val() || {};
    const transcripts = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));
    
    // Sort by timestamp
    transcripts.sort((a, b) => a.timestamp - b.timestamp);
    
    callback(transcripts);
  });
  
  return unsubscribe;
};

export { database, auth }; 