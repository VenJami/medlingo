import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, child, push, Database, serverTimestamp, update } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';

// Define Role type
export type Role = 'doctor' | 'patient';

// Define Participant structure (optional but good practice)
export interface ParticipantData {
  name: string;
  role: Role;
  isActive: boolean;
  joinedAt: number | object; // Can be number or ServerValue.TIMESTAMP
}

// Define Room structure (optional but good practice)
export interface RoomData {
  createdAt: number | object;
  createdBy: string;
  participants: {
    [userId: string]: ParticipantData;
  };
}

// Add interface for real-time typing status
export interface TypingStatus {
  isTyping: boolean;
  text: string;
  timestamp: number | object;
  speakerUid: string;
  speakerName: string;
  speakerRole: Role;
  originalLang: string;
  targetLang: string;
  clientTimestamp: number; // Local timestamp for client-side staleness detection
  sequence: number;      // Sequence number to handle out-of-order updates
}

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
export const createRoom = async (userName: string, userRole: Role): Promise<string | null> => {
  try {
    if (!database || !auth?.currentUser) return null;
    
    const userId = auth.currentUser.uid;
    // Generate a 6-character room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create room in database with initial participant
    const roomRef = ref(database, `rooms/${roomCode}`);
    const initialRoomData: RoomData = {
      createdAt: serverTimestamp(),
      createdBy: userId,
      participants: {
        [userId]: {
          name: userName,
          role: userRole,
          isActive: true,
          joinedAt: serverTimestamp(),
        }
      }
    };
    await set(roomRef, initialRoomData);
    
    return roomCode;
  } catch (error) {
    console.error('Error creating room:', error);
    return null;
  }
};

export const joinRoom = async (roomCode: string, userName: string): Promise<boolean> => {
  try {
    if (!database || !auth?.currentUser) return false;
    const userId = auth.currentUser.uid;
    const roomRef = ref(database, `rooms/${roomCode}`);
    
    // Check if room exists
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) {
      console.warn(`Room ${roomCode} does not exist.`);
      return false;
    }
    
    const roomData: RoomData = snapshot.val();
    const participants = roomData.participants || {};
    const participantIds = Object.keys(participants);

    // Check if user is rejoining
    if (participantIds.includes(userId)) {
      const existingParticipant = participants[userId];
      if (!existingParticipant.isActive) {
        // Rejoin: Update isActive status and potentially name
        const participantRef = ref(database, `rooms/${roomCode}/participants/${userId}`);
        await update(participantRef, { isActive: true, name: userName });
        console.log(`User ${userId} rejoined room ${roomCode}`);
        return true;
      } else {
        // Already active in the room
        console.log(`User ${userId} is already active in room ${roomCode}`);
        return true; // Still considered success for navigation
      }
    }

    // If user is not rejoining, check if the room has already reached its max participant history
    if (participantIds.length >= 2) {
      console.warn(`Room ${roomCode} has already had two participants. No new users allowed.`);
      return false; // Room is permanently full for new users
    }

    // Original check for ACTIVE participants (for role assignment, should only be 0 or 1 here)
    const activeParticipants = participantIds.filter(id => participants[id]?.isActive);
    // This check might be redundant now but kept for safety / role assignment logic clarity
    if (activeParticipants.length >= 2) {
      console.warn(`Room ${roomCode} already has two active participants.`);
      return false; // Room is full
    }

    // Determine the role for the new joiner
    let assignedRole: Role;
    if (activeParticipants.length === 1) {
      const existingActiveParticipant = participants[activeParticipants[0]];
      assignedRole = existingActiveParticipant.role === 'doctor' ? 'patient' : 'doctor';
    } else {
      // This case should ideally not happen if creator is always added first
      // Assign a default or handle as an error - assigning 'patient' for now
      console.warn(`Room ${roomCode} had no active participants. Assigning default role.`);
      assignedRole = 'patient';
    }
    
    // Add new participant
    const newParticipantRef = ref(database, `rooms/${roomCode}/participants/${userId}`);
    const newParticipantData: ParticipantData = {
      name: userName,
      role: assignedRole,
      isActive: true,
      joinedAt: serverTimestamp(),
    };
    await set(newParticipantRef, newParticipantData);
    console.log(`User ${userId} joined room ${roomCode} as ${assignedRole}`);
    
    return true;

  } catch (error) {
    console.error(`Error joining room ${roomCode}:`, error);
    return false;
  }
};

export const leaveRoom = async (roomCode: string): Promise<boolean> => {
  try {
    if (!database || !auth?.currentUser) return false;
    const userId = auth.currentUser.uid;
    const participantRef = ref(database, `rooms/${roomCode}/participants/${userId}`);

    // Check if participant exists before trying to update
    const snapshot = await get(participantRef);
    if (snapshot.exists()) {
      await update(participantRef, { isActive: false });
      console.log(`User ${userId} left room ${roomCode}`);
      return true;
    } else {
      console.warn(`User ${userId} not found in room ${roomCode} to leave.`);
      return false;
    }
  } catch (error) {
    console.error(`Error leaving room ${roomCode}:`, error);
    return false;
  }
};

export const listenToRoomData = (roomCode: string, callback: (data: RoomData | null) => void) => {
  if (!database) return () => {};
  
  const roomRef = ref(database, `rooms/${roomCode}`);
  const unsubscribe = onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });
  
  return unsubscribe;
};

// Define the structure of the data expected by saveTranscript
interface TranscriptSaveData {
  timestamp: number | object;
  speakerUid: string;
  speakerName: string;
  speakerRole: Role;
  originalLang: string;
  originalText: string;
  targetLang: string;
  translatedText: string;
}

// Updated function to save the full turn data
export const saveTranscript = async (roomCode: string, turnData: TranscriptSaveData): Promise<boolean> => {
  try {
    if (!database || !auth?.currentUser) return false;
    
    console.log(`[Firebase] Saving transcript to room ${roomCode}`, turnData);
    
    // Use push to generate a unique key for each transcript entry
    const transcriptsRef = ref(database, `rooms/${roomCode}/transcripts`);
    const newTranscriptRef = push(transcriptsRef); // Generate unique ref
    
    // Set the data at the unique ref, ensuring field names match what listenToTranscripts expects
    await set(newTranscriptRef, {
      ...turnData,
      // Ensure field names are consistent - speakerUid is used in the listener
      speakerUid: turnData.speakerUid,  // This field name is critical
      timestamp: serverTimestamp() // Ensure server timestamp is used
    });
    
    console.log(`[Firebase] Successfully saved transcript with ID: ${newTranscriptRef.key}`);
    return true;
  } catch (error) {
    console.error('[Firebase] Error saving transcript:', error);
    return false;
  }
};

export const listenToTranscripts = (roomCode: string, callback: (transcripts: any[]) => void) => {
  if (!database) {
    console.error("[Firebase] Database is not initialized");
    return () => {};
  }
  
  console.log(`[Firebase] Setting up transcript listener for room: ${roomCode}`);
  
  try {
  const transcriptsRef = ref(database, `rooms/${roomCode}/transcripts`);
    
    // Using onValue to listen for all changes including additions, updates, and removals
  const unsubscribe = onValue(transcriptsRef, (snapshot) => {
      try {
        console.log(`[Firebase] Received transcript update for room: ${roomCode}`);
    const data = snapshot.val() || {};
        
        if (!data) {
          console.log(`[Firebase] No transcripts found for room: ${roomCode}`);
          callback([]);
          return;
        }
        
        // Transform object to array with id included
        const transcripts = Object.keys(data).map(key => {
          const transcript = data[key];
          
          // Ensure speakerUid field exists (it's critical)
          // Some older data might have used 'uid' instead
          if (transcript.uid && !transcript.speakerUid) {
            transcript.speakerUid = transcript.uid;
          }
          
          return {
            id: key, // Include the Firebase key as id
            ...transcript
          };
        });
        
        console.log(`[Firebase] Processing ${transcripts.length} transcripts`);
        
        // Ensure all required fields are present
        const validTranscripts = transcripts.filter(t => {
          const isValid = t.timestamp && t.speakerUid && 
                          t.originalText && t.translatedText && 
                          t.originalLang && t.targetLang;
          
          if (!isValid) {
            console.warn(`[Firebase] Found invalid transcript:`, t);
          }
          return isValid;
        });
        
        console.log(`[Firebase] Valid transcripts: ${validTranscripts.length}/${transcripts.length}`);
        
        // Sort by timestamp, handling both server timestamps (objects) and client timestamps (numbers)
        validTranscripts.sort((a, b) => {
          // Handle server timestamps (convert to milliseconds) vs client timestamps (numbers)
          const getTime = (timestamp: any) => {
            if (typeof timestamp === 'object' && timestamp !== null) {
              // Server timestamp object
              if (timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
                return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
              }
              // Handle other timestamp formats if needed
              return 0;
            }
            // Regular numeric timestamp
            return timestamp;
          };
          
          const timeA = getTime(a.timestamp);
          const timeB = getTime(b.timestamp);
          
          return timeA - timeB;
        });
        
        // Send the processed data to the callback
        callback(validTranscripts);
      } catch (processError) {
        console.error(`[Firebase] Error processing transcripts:`, processError);
        // Return empty array to prevent UI errors
        callback([]);
      }
    }, (error) => {
      // Error handling for the onValue listener
      console.error(`[Firebase] Error listening to transcripts: ${error.message}`);
    });
    
    return unsubscribe;
  } catch (setupError) {
    console.error(`[Firebase] Error setting up transcript listener:`, setupError);
    // Return no-op function as fallback
    return () => {};
  }
};

// Create a counter for tracking update sequences
let typingSequence = 0;

// More direct function to update real-time speech
export const updateRealtimeSpeech = async (
  roomCode: string, 
  speechData: {
    text: string;
    speakerUid: string;
    speakerName: string;
    speakerRole: Role;
    originalLang: string;
    targetLang: string;
  }
): Promise<boolean> => {
  try {
    console.log(`[Firebase] 🔍 UPDATE CALLED with room: ${roomCode}, data:`, speechData);
    
    if (!database) {
      console.error('[Firebase] ❌ Cannot update speech: database not initialized');
      return false;
    }
    
    if (!auth?.currentUser) {
      console.error('[Firebase] ❌ Cannot update speech: auth not initialized or user not logged in');
      return false;
    }
    
    // Verify input data is valid
    if (!speechData.text || !speechData.speakerUid || !speechData.speakerName) {
      console.error('[Firebase] ❌ Invalid speech data:', speechData);
      return false;
    }
    
    if (!roomCode) {
      console.error('[Firebase] ❌ Invalid room code:', roomCode);
      return false;
    }
    
    // Increment sequence number for ordering
    typingSequence++;
    
    // Create the status object with all needed fields
    const status = {
      isTyping: true,
      text: speechData.text,
      speakerUid: speechData.speakerUid,
      speakerName: speechData.speakerName,
      speakerRole: speechData.speakerRole,
      originalLang: speechData.originalLang,
      targetLang: speechData.targetLang,
      clientTimestamp: Date.now(),
      sequence: typingSequence,
    };
    
    // Log with clear identifiable marker for debugging between users
    console.log(`[Firebase] 🎙️ SENDING real-time speech update [USER: ${speechData.speakerUid}]:`, JSON.stringify(status));
    
    // Construct the path to the real-time speech location
    const path = `rooms/${roomCode}/realtimeSpeech/${speechData.speakerUid}`;
    console.log(`[Firebase] 📍 Writing to path: ${path}`);
    
    // Store speech directly at a specific path for this user
    // This approach is simpler and more direct than the previous one
    const speechRef = ref(database, path);
    
    // Try a simpler data structure first to check if the issue is data complexity
    const simpleData = {
      isTyping: true,
      text: speechData.text,
      speakerUid: speechData.speakerUid,
      speakerName: speechData.speakerName,
      speakerRole: speechData.speakerRole || "unknown",
      timestamp: serverTimestamp()
    };
    
    // Use set instead of update to ensure complete replacement
    await set(speechRef, simpleData);
    
    // Verify the data was saved
    const snapshot = await get(speechRef);
    if (snapshot.exists()) {
      console.log(`[Firebase] ✅ Verified data was saved at ${path}:`, snapshot.val());
    } else {
      console.error(`[Firebase] ❌ Data was NOT saved at ${path}`);
      return false;
    }
    
    console.log(`[Firebase] ✅ Successfully sent real-time speech update [seq: ${typingSequence}, uid: ${speechData.speakerUid}]`);
    return true;
  } catch (error) {
    console.error('[Firebase] ❌ Error updating real-time speech:', error);
    return false;
  }
};

/**
 * Clear real-time speech for a specific user in a room
 */
export const clearRealtimeSpeech = async (
  roomCode: string,
  speakerUid: string
): Promise<boolean> => {
  try {
    if (!database) {
      console.error('[Firebase] Cannot clear speech: database not initialized');
      return false;
    }
    
    console.log(`[Firebase] 🧹 Clearing real-time speech for user ${speakerUid} in room ${roomCode}`);
    
    // Check if the database reference exists before trying to clear it
    const speechRef = ref(database, `rooms/${roomCode}/realtimeSpeech/${speakerUid}`);
    
    // Set to null to remove the node entirely
    await set(speechRef, null);
    
    console.log(`[Firebase] ✅ Successfully cleared real-time speech for user ${speakerUid} in room ${roomCode}`);
    return true;
  } catch (error) {
    console.error('[Firebase] ❌ Error clearing real-time speech:', error);
    return false;
  }
};

// Enhanced function to listen for real-time speech updates
export const listenToRealtimeSpeech = (
  roomCode: string, 
  callback: (speeches: TypingStatus[]) => void
) => {
  if (!database) {
    console.error("[Firebase] ❌ Database is not initialized");
    return () => {};
  }
  
  try {
    console.log(`[Firebase] 👂 Setting up real-time speech listener for room: ${roomCode}`);
    
    // Listen directly to the real-time speech node
    const speechRef = ref(database, `rooms/${roomCode}/realtimeSpeech`);
    
    // First, try a single get to see if there's data
    get(speechRef).then(snapshot => {
      console.log(`[Firebase] 🔎 Initial data check:`, 
        snapshot.exists() ? "Data exists" : "No data found", 
        snapshot.exists() ? JSON.stringify(snapshot.val()) : "");
    }).catch(err => {
      console.error("[Firebase] ❌ Error checking initial data:", err);
    });
    
    const unsubscribe = onValue(speechRef, (snapshot) => {
      try {
        console.log(`[Firebase] 📢 Received real-time speech update for room: ${roomCode}`);
        const data = snapshot.val();
        
        // Exit early if there's no data
        if (!data) {
          console.log(`[Firebase] 💬 No active speeches found (data is null)`);
          callback([]);
          return;
        }
        
        // Log the raw data - critical for debugging
        console.log(`[Firebase] 📝 Raw data from Firebase:`, JSON.stringify(data));
        
        // Convert object to array of speeches with a simpler approach
        const speeches: TypingStatus[] = [];
        
        for (const uid in data) {
          if (data.hasOwnProperty(uid)) {
            const speechData = data[uid];
            if (speechData && typeof speechData === 'object') {
              speeches.push({
                speakerUid: uid,
                ...speechData,
                // Ensure required fields have fallbacks
                isTyping: speechData.isTyping ?? true,
                text: speechData.text ?? "",
                timestamp: speechData.timestamp ?? Date.now(),
                clientTimestamp: speechData.clientTimestamp ?? Date.now(),
                sequence: speechData.sequence ?? 0
              });
            }
          }
        }
        
        console.log(`[Firebase] 📋 Processed ${speeches.length} real-time speeches`);
        
        // Filter out speeches with empty text
        const nonEmptySpeeches = speeches.filter(speech => 
          speech && speech.text && speech.text.trim().length > 0
        );
        
        if (nonEmptySpeeches.length > 0) {
          console.log(`[Firebase] 💬 Valid speeches: ${nonEmptySpeeches.length}`, 
            nonEmptySpeeches.map(s => ({
              uid: s.speakerUid,
              name: s.speakerName || "Unknown",
              text: s.text.substring(0, 30) + (s.text.length > 30 ? '...' : '')
            }))
          );
          
          // Important: Send ALL speeches to the callback
          callback(nonEmptySpeeches);
        } else {
          console.log(`[Firebase] 💬 No active speeches found (after filtering)`);
          callback([]);
        }
      } catch (processError) {
        console.error('[Firebase] ❌ Error processing real-time speeches:', processError);
        callback([]);
      }
    }, (error) => {
      console.error(`[Firebase] ❌ Error listening to real-time speeches: ${error.message}`);
  });
  
  return unsubscribe;
  } catch (setupError) {
    console.error('[Firebase] ❌ Error setting up real-time speech listener:', setupError);
    return () => {};
  }
};

export { database, auth }; 