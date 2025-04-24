'use client';

import { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  push, 
  child, 
  onDisconnect, 
  serverTimestamp, 
  get,
  Database,
  DatabaseReference
} from 'firebase/database';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  Auth
} from 'firebase/auth';
import { User } from 'firebase/auth';
import { 
  database, 
  auth, 
  listenToRoomData, 
  listenToTranscripts, 
  saveTranscript, 
  leaveRoom, 
  RoomData, 
  ParticipantData, 
  Role, 
  updateRealtimeSpeech,
  clearRealtimeSpeech,
  listenToRealtimeSpeech,
  TypingStatus
} from '../utils/firebase';

import { 
  getSpeechRecognition, 
  getVoices, 
  speakText, 
  translateWithAI, 
  getTranscripts
} from '../utils/speechUtils';

import RealtimeSpeechPanel from './RealtimeSpeechPanel';

// Define structure for a single conversation turn
interface ConversationTurn {
  id: string;                 // Unique ID (Firebase key)
  timestamp: number;
  speakerUid: string;
  speakerName: string;
  speakerRole: Role;
  originalLang: string;
  originalText: string;
  targetLang: string;
  translatedText: string;
}

interface TranslationAppProps {
  roomCode: string;
  onLeaveRoom: () => void;
}

// Add type definition for RealtimeSpeechPanel at the top of the file after imports
interface RealtimeSpeechPanel {
  isConnected: boolean;
  otherUserSpeaking: boolean;
  otherUserText: string;
}

const TranslationApp = ({ roomCode, onLeaveRoom }: TranslationAppProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('es-ES');
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);

  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const recognitionRef = useRef<any>(null);
  const accumulatedTextRef = useRef<string>('');

  // --- Auto-scrolling Refs ---
  const panel1Ref = useRef<HTMLDivElement>(null);
  const panel2Ref = useRef<HTMLDivElement>(null);

  // Add new state for current active transcription
  const [activeTranscription, setActiveTranscription] = useState<string>('');

  // Add state to track real-time typing from other users
  const [otherUsersSpeaking, setOtherUsersSpeaking] = useState<TypingStatus[]>([]);

  // Add a new debugging state
  const [debugInfo, setDebugInfo] = useState<{
    lastSent: string | null;
    lastReceived: Array<{uid: string, text: string}>;
    updateCount: number;
  }>({
    lastSent: null,
    lastReceived: [],
    updateCount: 0
  });

  // Add a ref to track the last sent speech text to avoid duplicate updates
  const lastSentSpeechRef = useRef<string>('');

  // Add this state variable at the top of the component with other state declarations
  const [isTestingFirebase, setIsTestingFirebase] = useState<boolean>(false);

  // 1. Add state at top
  const [rawSpeechSnapshot, setRawSpeechSnapshot] = useState<any>(null);

  const languageOptions = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'es-ES', label: 'Spanish (Spain)' },
    { value: 'fr-FR', label: 'French (France)' },
    { value: 'de-DE', label: 'German (Germany)' },
    { value: 'ja-JP', label: 'Japanese (Japan)' },
    { value: 'zh-CN', label: 'Chinese (Simplified)' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
    { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
    { value: 'tl-PH', label: 'Tagalog (Philippines)' }
  ];

  useEffect(() => {
    if (!roomCode) return;

    const unsubscribe = listenToRoomData(roomCode, (data) => {
      setRoomData(data);
      if (!data) {
        console.warn('Room data is null. Returning to home.');
        setErrorMessage('Room session ended or not found.');
        setTimeout(onLeaveRoom, 3000); 
      }
    });

    return () => unsubscribe();
  }, [roomCode, onLeaveRoom]);

  // Effect to listen for transcript changes
  useEffect(() => {
    if (!roomCode || !roomData?.participants) return;

    console.log(`[TranslationApp] Setting up transcript listener for room: ${roomCode}`);
    const unsubscribe = listenToTranscripts(roomCode, (rawTranscripts) => {
      console.log(`[TranslationApp] Received ${rawTranscripts.length} transcripts from Firebase`);
      
      // Enrich raw transcript data with speaker info
      const enrichedTurns = rawTranscripts.map(t => {
        // Check if transcript data is valid
        if (!t || !t.speakerUid || !t.timestamp || !t.originalText || !t.translatedText || !t.originalLang || !t.targetLang) {
          console.warn('[TranslationApp] Received incomplete transcript data:', t);
          return null; // Skip incomplete data
        }
        
        const participant = roomData.participants[t.speakerUid];
        if (!participant) {
          console.warn(`[TranslationApp] Could not find participant data for user ${t.speakerUid}`, t);
        }
        
        return {
          id: t.id,
          timestamp: t.timestamp,
          speakerUid: t.speakerUid,
          speakerName: participant?.name || t.speakerName || 'Unknown', // Try different sources
          speakerRole: participant?.role || t.speakerRole || 'patient', // Try different sources
          originalLang: t.originalLang,
          originalText: t.originalText,
          targetLang: t.targetLang,
          translatedText: t.translatedText,
        } as ConversationTurn;
      }).filter(turn => turn !== null) as ConversationTurn[]; // Ensure correct type after filtering

      console.log(`[TranslationApp] Processed ${enrichedTurns.length} valid transcripts`);
      
      // Update turns efficiently by comparing with existing data
      setConversationTurns(prevTurns => {
        // Create a lookup map of existing turns by ID for fast access
        const existingTurnsMap = new Map(
          prevTurns
            .filter(turn => !turn.id.startsWith('temp-')) // Keep only non-temporary turns
            .map(turn => [turn.id, turn])
        );
        
        // Process each enriched turn
        enrichedTurns.forEach(turn => {
          // If not already in our map, or if this is an update to an existing turn, add it
          if (!existingTurnsMap.has(turn.id)) {
            existingTurnsMap.set(turn.id, turn);
          }
        });
        
        // Keep any temporary turns for current UI state
        const tempTurns = prevTurns.filter(turn => turn.id.startsWith('temp-'));
        
        // Combine everything and sort
        const combinedTurns = [...existingTurnsMap.values(), ...tempTurns];
        return combinedTurns.sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    // Cleanup listener
    return () => {
      console.log(`[TranslationApp] Cleaning up transcript listener for room: ${roomCode}`);
      unsubscribe();
    };
    // Dependency on roomData ensures enrichment happens when participant info is available
  }, [roomCode, roomData]);

  useEffect(() => {
    const initVoices = async () => {
      try {
        const voices = await getVoices();
        setAvailableVoices(voices);
        const defaultVoice = voices.find((v: SpeechSynthesisVoice) => v.lang.includes(targetLanguage.split('-')[0])) || voices[0];
        setSelectedVoice(defaultVoice);
      } catch (error) {
        console.error('Error initializing voices:', error);
        setErrorMessage('Unable to initialize text-to-speech voices.');
      }
    };
    initVoices();
  }, [targetLanguage]);

  const { myData, otherParticipantData } = useMemo(() => {
    const userId = auth?.currentUser?.uid;
    if (!userId || !roomData?.participants) {
      return { myData: null, otherParticipantData: null };
    }
    const participants = roomData.participants;
    const myData = participants[userId];
    
    const otherParticipantId = Object.keys(participants).find(
      id => id !== userId && participants[id]?.isActive
    );
    const otherParticipantData = otherParticipantId ? participants[otherParticipantId] : null;

    return { myData, otherParticipantData };

  }, [roomData]);

  useEffect(() => {
    const setupRecognition = () => {
      try {
        const recognition = getSpeechRecognition();
        if (!recognition) {
          setErrorMessage('Speech recognition is not supported.');
          return;
        }

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = sourceLanguage;

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscriptPart = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscriptPart += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }
          
          // Update accumulated text with final parts
          if (finalTranscriptPart) {
            accumulatedTextRef.current += finalTranscriptPart;
            console.log("[Speech] Final transcript part:", finalTranscriptPart);
            console.log("[Speech] Accumulated text:", accumulatedTextRef.current);
          }
          
          // Current full text combining accumulated final parts and current interim results
          const currentFullText = accumulatedTextRef.current + (interimTranscript || '');
          
          // Update the active transcription and send to other users
          if (currentFullText.trim()) {
            console.log("[Speech] Updating active transcription:", currentFullText);
            // Use the improved function instead
            updateLiveTranscriptionImproved(currentFullText);
          }
          
          // Also update conversation turns for consistency
          const currentUser = auth?.currentUser;
          if (currentUser && myData && currentFullText.trim()) {
            console.log("[Speech] Creating temporary turn with text:", currentFullText);
            
            // Create a timestamp to ensure uniqueness and for debugging
            const now = Date.now();
            const tempId = `temp-current-speech-${now}`;
            
            const tempTurn: ConversationTurn = {
              id: tempId,
              timestamp: now,
              speakerUid: currentUser.uid,
              speakerName: myData.name,
              speakerRole: myData.role,
              originalLang: sourceLanguage,
              originalText: currentFullText,
              targetLang: targetLanguage,
              translatedText: "..." // Translation pending
            };
            
            // Force temporary speech to be VERY visible for debugging
            console.log("[Speech] ATTEMPTING TO UPDATE UI with temp turn:", tempTurn);
            
            // Update the UI with temporary results - critical for user feedback
            setConversationTurns(prev => {
              // Log the current turns for debugging
              console.log("[Speech] Current conversation turns before update:", prev.length);
              
              // Filter out any previous temporary turns
              const filtered = prev.filter(turn => !turn.id.startsWith('temp-'));
              console.log("[Speech] Filtered turns (removed temps):", filtered.length);
              
              const newTurns = [...filtered, tempTurn];
              console.log("[Speech] New turns with temp added:", newTurns.length);
              
              return newTurns;
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          // If it's a network glitch, retry recognition
          if (event.error === 'network') {
            console.warn('[Speech] Network error encountered, retrying recognition...');
            setErrorMessage('Network error, retrying...');
            // Don't clear accumulated text or stop recording, attempt restart
            setTimeout(() => {
              try {
                recognition.start();
              } catch (e) {
                console.error('[Speech] Error restarting after network error:', e);
              }
            }, 500);
            return;
          }
          let userFriendlyError = `Speech recognition error: ${event.error}`;
          if (event.error === 'no-speech') userFriendlyError = 'No speech detected.';
          else if (event.error === 'audio-capture') userFriendlyError = 'Microphone error.';
          else if (event.error === 'not-allowed') userFriendlyError = 'Microphone access denied.';
          
          setErrorMessage(userFriendlyError);
          setIsRecording(false);
          // Preserve accumulatedTextRef.current so user can restart seamlessly
        };

        recognition.onend = () => {
          console.log("[Speech] Recognition ended");
          if (isRecording && recognitionRef.current) {
             try {
                 setTimeout(() => {
                     if (isRecording && recognitionRef.current && !['not-allowed', 'service-not-allowed'].includes(recognitionRef.current.error)) {
                         console.log("[Speech] Restarting recognition after end");
                         recognitionRef.current.start();
                     } else {
                         setIsRecording(false);
                     }
                 }, 300);
             } catch (e) {
                 console.error("[Speech] Error restarting recognition:", e);
                 setIsRecording(false);
             }
          }
        };
        recognitionRef.current = recognition;
      } catch (error) {
        console.error('Error setting up speech recognition:', error);
        setErrorMessage('Failed to set up speech recognition.');
      }
    };

    setupRecognition();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        try {
          if(isRecording) recognitionRef.current.stop();
        } catch(e) {/* ignore */}
        recognitionRef.current = null;
      }
    };
  }, [sourceLanguage]);

  const toggleRecording = () => {
    try {
      if (isRecording) {
        console.log("[toggleRecording] Stopping recording");
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setIsRecording(false); 
        setActiveTranscription('');
        
        // Clear real-time speech when stopping recording - use direct Firebase access for reliability
        if (database && auth?.currentUser && roomCode) {
          const userId = auth.currentUser.uid;
          console.log("[toggleRecording] Clearing real-time speech directly");
          
          // Use direct Firebase access for maximum reliability
          const db = database as Database; // Add type assertion here
          const speechRef = ref(db, `rooms/${roomCode}/realtimeSpeech/${userId}`);
          set(speechRef, null)
            .then(() => {
              console.log("[toggleRecording] Successfully cleared real-time speech directly");
            })
            .catch(error => {
              console.error("[toggleRecording] Error clearing real-time speech:", error);
              
              // As a fallback, try the utility function
              clearRealtimeSpeech(roomCode, userId)
                .then(success => {
                  console.log("[toggleRecording] Fallback clear result:", success);
                })
                .catch(fallbackError => {
                  console.error("[toggleRecording] Fallback clear also failed:", fallbackError);
                });
            });
          
          // Clear the last sent speech ref
          lastSentSpeechRef.current = '';
        }
        
        const textToTranslate = accumulatedTextRef.current.trim();
        console.log("[toggleRecording] Final text to translate:", textToTranslate);
        
        if (textToTranslate) {
          console.log("[Stop Record] Translating full transcript:", textToTranslate);
          // Remove any temporary transcript displays before translation
          setConversationTurns(prev => prev.filter(turn => !turn.id.startsWith('temp-')));
          // Start translation process
          handleTranslation(textToTranslate); 
        } else {
          console.warn("[toggleRecording] No text accumulated to translate");
          // Just clean up the temporary transcripts if there's nothing to translate
          setConversationTurns(prev => prev.filter(turn => !turn.id.startsWith('temp-')));
        }
        accumulatedTextRef.current = '';
  
        // Clean up typing status when stopping recording
        const currentUser = auth?.currentUser;
        if (currentUser && myData) {
          clearRealtimeSpeech(roomCode, currentUser.uid)
            .catch((error: Error) => {
              console.error("[toggleRecording] Error clearing real-time speech:", error);
            });
        }
      } else {
        console.log("[toggleRecording] Starting recording");
        setErrorMessage(null);
        accumulatedTextRef.current = '';
        setActiveTranscription(''); // Clear active transcription
        
        // Clear any previous conversation turns with temp IDs when starting new recording
        setConversationTurns(prev => prev.filter(turn => !turn.id.startsWith('temp-')));
        
        if (!recognitionRef.current) {
          console.error("[toggleRecording] Recognition not ready, creating new instance");
          try {
            recognitionRef.current = getSpeechRecognition();
            if (!recognitionRef.current) {
              throw new Error("Could not initialize speech recognition");
            }
            
            // Re-initialize recognition settings
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            
            // Set up event handlers
            recognitionRef.current.onresult = (event: any) => {
              let interimTranscript = '';
              let finalTranscriptPart = '';
              
              for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                  finalTranscriptPart += transcript + ' ';
                } else {
                  interimTranscript += transcript;
                }
              }
              
              // Update accumulated text with final parts
              if (finalTranscriptPart) {
                accumulatedTextRef.current += finalTranscriptPart;
                console.log("[Speech] Final transcript part:", finalTranscriptPart);
                console.log("[Speech] Accumulated text:", accumulatedTextRef.current);
              }
              
              // Current full text combining accumulated final parts and current interim results
              const currentFullText = accumulatedTextRef.current + (interimTranscript || '');
              
              // Update the active transcription and send to other users
              if (currentFullText.trim()) {
                console.log("[Speech] Updating active transcription:", currentFullText);
                // Use the improved function instead
                updateLiveTranscriptionImproved(currentFullText);
              }
              
              // Also update conversation turns for consistency
              const currentUser = auth?.currentUser;
              if (currentUser && myData && currentFullText.trim()) {
                console.log("[Speech] Creating temporary turn with text:", currentFullText);
                
                // Create a timestamp to ensure uniqueness and for debugging
                const now = Date.now();
                const tempId = `temp-current-speech-${now}`;
                
                const tempTurn: ConversationTurn = {
                  id: tempId,
                  timestamp: now,
                  speakerUid: currentUser.uid,
                  speakerName: myData.name,
                  speakerRole: myData.role,
                  originalLang: sourceLanguage,
                  originalText: currentFullText,
                  targetLang: targetLanguage,
                  translatedText: "..." // Translation pending
                };
                
                // Force temporary speech to be VERY visible for debugging
                console.log("[Speech] ATTEMPTING TO UPDATE UI with temp turn:", tempTurn);
                
                // Update the UI with temporary results - critical for user feedback
                setConversationTurns(prev => {
                  // Log the current turns for debugging
                  console.log("[Speech] Current conversation turns before update:", prev.length);
                  
                  // Filter out any previous temporary turns
                  const filtered = prev.filter(turn => !turn.id.startsWith('temp-'));
                  console.log("[Speech] Filtered turns (removed temps):", filtered.length);
                  
                  const newTurns = [...filtered, tempTurn];
                  console.log("[Speech] New turns with temp added:", newTurns.length);
                  
                  return newTurns;
                });
              }
            };
            
            recognitionRef.current.onerror = (event: any) => {
              console.error('Speech recognition error:', event.error);
              if (event.error === 'network') {
                console.warn('[toggleRecording] Network error, retrying recognition...');
                setErrorMessage('Network error, retrying...');
                setTimeout(() => {
                  try { recognitionRef.current.start(); } catch {}
                }, 500);
                return;
              }
              let userFriendlyError = `Speech recognition error: ${event.error}`;
              if (event.error === 'no-speech') userFriendlyError = 'No speech detected.';
              else if (event.error === 'audio-capture') userFriendlyError = 'Microphone error.';
              else if (event.error === 'not-allowed') userFriendlyError = 'Microphone access denied.';
              
              setErrorMessage(userFriendlyError);
              setIsRecording(false);
              accumulatedTextRef.current = '';
            };
            
            recognitionRef.current.onend = () => {
              console.log("[Speech] Recognition ended");
              if (isRecording && recognitionRef.current) {
                 try {
                     setTimeout(() => {
                         if (isRecording && recognitionRef.current && !['not-allowed', 'service-not-allowed'].includes(recognitionRef.current.error)) {
                             console.log("[Speech] Restarting recognition after end");
                             recognitionRef.current.start();
                         } else {
                             setIsRecording(false);
                         }
                     }, 300);
                 } catch (e) {
                     console.error("[Speech] Error restarting recognition:", e);
                     setIsRecording(false);
                 }
              }
            };
          } catch (error) {
            console.error("[toggleRecording] Failed to create recognition instance:", error);
            setErrorMessage("Speech recognition not available. Please check your browser's microphone permissions.");
          return; 
          }
        }
  
        recognitionRef.current.lang = sourceLanguage;
        try {
          console.log("[toggleRecording] Starting recognition with language:", sourceLanguage);
        recognitionRef.current.start();
        setIsRecording(true);
        } catch (startError) {
          console.error("[toggleRecording] Error starting recognition:", startError);
          setErrorMessage("Failed to start speech recognition. Please try again.");
        }
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      setErrorMessage('Failed to toggle recording. Check mic/permissions.');
      setIsRecording(false);
      accumulatedTextRef.current = '';
    }
  };
  
  const handleTranslation = async (textToTranslate: string) => {
    if (!textToTranslate) {
      console.warn("[handleTranslation] No text provided to translate");
      return;
    }
    
    // Log for debugging
    console.log(`[handleTranslation] Processing text (${textToTranslate.length} chars): "${textToTranslate.substring(0, 50)}..."`); 
    
    // Track performance
    const startTime = Date.now();
    setIsTranslating(true);
  
    try {
      // Ensure we have current user data before proceeding
      const currentUser = auth?.currentUser;
      const currentSpeakerData = myData; // Use derived myData
      if (!currentUser || !currentSpeakerData) {
        throw new Error('User data not available to save transcript.');
      }

      // Show a "translating" state message to improve user experience
      setConversationTurns(prev => {
        // Filter out any temporary transcript displays first
        const filtered = prev.filter(turn => !turn.id.startsWith('temp-'));
        
        // Add a temporary "translating" message
        const translatingTurn: ConversationTurn = {
          id: 'temp-translating-' + Date.now(),
          timestamp: Date.now(),
          speakerUid: currentUser.uid,
          speakerName: currentSpeakerData.name,
          speakerRole: currentSpeakerData.role,
          originalLang: sourceLanguage,
          originalText: textToTranslate,
          targetLang: targetLanguage,
          translatedText: "Translating..." // Show that translation is in progress
        };
        
        return [...filtered, translatingTurn];
      });

      console.log(`[handleTranslation] Starting translation from ${sourceLanguage} to ${targetLanguage}...`);
      // Tracking translation step
      const translationStartTime = Date.now();
      
      const translatedResult = await translateWithAI(
        textToTranslate, 
        sourceLanguage,
        targetLanguage
      );
      
      // Calculate translation time
      const translationTime = Date.now() - translationStartTime;
      console.log(`[handleTranslation] Translation completed in ${translationTime}ms`);
      
      if (translatedResult) {
        console.log(`[handleTranslation] Translation result (${translatedResult.length} chars): "${translatedResult.substring(0, 50)}..."`);
        
        // Construct the full ConversationTurn object with all required fields
        const newTurnData = {
          timestamp: Date.now(),
          speakerUid: currentUser.uid,
          speakerName: currentSpeakerData.name,
          speakerRole: currentSpeakerData.role,
          originalLang: sourceLanguage,
          originalText: textToTranslate,
          targetLang: targetLanguage,
          translatedText: translatedResult,
        };

        // Save to Firebase step
        console.log(`[handleTranslation] Saving transcript to Firebase...`);
        const saveStartTime = Date.now();
        
        const saveResult = await saveTranscript(roomCode, newTurnData);
        
        const saveTime = Date.now() - saveStartTime;
        console.log(`[handleTranslation] Firebase save completed in ${saveTime}ms, result: ${saveResult}`);
        
        if (!saveResult) {
          throw new Error("Failed to save transcript to the database.");
        }

        // Update UI immediately for better responsiveness
        // Note: Firebase listener should eventually replace this with the server version
        setConversationTurns(prev => {
          const withoutTemps = prev.filter(turn => !turn.id.startsWith('temp-'));
          const updatedTurns = [
            ...withoutTemps,
            { ...newTurnData, id: 'local-' + Date.now() }
          ].sort((a, b) => a.timestamp - b.timestamp);
          
          console.log(`[handleTranslation] Updated conversation turns - Total: ${updatedTurns.length}`);
          return updatedTurns;
        });
        
        // Log total processing time
        const totalTime = Date.now() - startTime;
        console.log(`[handleTranslation] Total processing time: ${totalTime}ms`);
      } else {
         throw new Error("Translation result was empty.");
      }
  
    } catch (error: any) {
      console.error('[handleTranslation] Error processing translation:', error);
      
      // Remove any temporary "translating" messages on error
      setConversationTurns(prev => 
        prev.filter(turn => !turn.id.startsWith('temp-'))
      );
      
      setErrorMessage(`Translation Error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
      .then(() => {
        alert('Room code copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy room code: ', err);
        setErrorMessage('Failed to copy room code.');
      });
  };

  const getFormattedTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const myLabel = "Original Transcript";
  const remoteLabel = "Translation";

  // Improved auto-scrolling effect to ensure the panels stay at the bottom when new content appears
  useEffect(() => {
    const scrollPanels = () => {
      if (panel1Ref.current) {
        panel1Ref.current.scrollTop = panel1Ref.current.scrollHeight;
      }
      if (panel2Ref.current) {
        panel2Ref.current.scrollTop = panel2Ref.current.scrollHeight;
      }
    };
    
    // Immediate scroll
    scrollPanels();
    
    // Also attempt scroll after a short delay to handle any layout adjustments
    const timeoutId = setTimeout(scrollPanels, 100);
    
    return () => clearTimeout(timeoutId);
  }, [conversationTurns]); // Scroll when turns change

  // --- Dynamic Labels ---
  const sourceLangLabel = useMemo(() => languageOptions.find(l => l.value === sourceLanguage)?.label || sourceLanguage, [sourceLanguage]);
  const targetLangLabel = useMemo(() => languageOptions.find(l => l.value === targetLanguage)?.label || targetLanguage, [targetLanguage]);

  // Additional styles for different message states
  const messageStyles = {
    recording: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderLeft: '3px solid rgba(16, 185, 129, 0.7)',
      padding: '12px',
      borderRadius: '4px',
      marginBottom: '8px',
      position: 'relative' as 'relative',
      animation: 'pulse 1.5s infinite'
    },
    translating: {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      borderLeft: '3px solid rgba(59, 130, 246, 0.7)',
      padding: '12px',
      borderRadius: '4px',
      marginBottom: '8px'
    },
    normal: {
      padding: '12px',
      borderRadius: '4px',
      marginBottom: '8px',
    }
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1f2e 0%, #2c3347 100%)', 
      color: '#ffffff',
      padding: '1.5rem',

      fontFamily: 'system-ui, sans-serif'
    },
    header: {
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'space-between' as 'space-between',
      alignItems: 'center' as 'center',
      marginBottom: '1rem',
      paddingBottom: '1rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      flexWrap: 'wrap' as 'wrap',
      gap: '1rem'
    },
    title: {
      fontSize: '1.75rem',
      fontWeight: 'bold' as 'bold',
      color: '#60a5fa'
    },
    headerControls: {
        display: 'flex',
        alignItems: 'center' as 'center',
        gap: '1rem'
    },
    roomCode: {
        display: 'flex',
        alignItems: 'center' as 'center',
        gap: '0.5rem',
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '0.6rem 1rem',
        borderRadius: '8px',
        fontSize: '0.9rem',
        fontFamily: 'monospace',
        cursor: 'pointer' as 'pointer',
        transition: 'all 0.2s ease',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        '&:hover': {
          background: 'rgba(255, 255, 255, 0.15)',
          transform: 'translateY(-2px)'
        }
    },
    leaveButton: {
        padding: '0.6rem 1.2rem',
        background: 'linear-gradient(to right, #dc2626, #ef4444)', 
        border: 'none', 
        color: 'white', 
        borderRadius: '8px', 
        cursor: 'pointer' as 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        opacity: isLeaving ? 0.6 : 1,
        pointerEvents: isLeaving ? 'none' : 'auto' as 'none' | 'auto',
        boxShadow: '0 4px 6px rgba(220, 38, 38, 0.25)',
        transition: 'all 0.2s ease'
    },
    contentArea: {
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column' as 'column',
        gap: '1rem',
        overflow: 'auto' as 'auto',
        minHeight: 0 
    },
    selectorsRow: {
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
    },
    selectorContainer: {
        display: 'flex',
        flexDirection: 'column' as 'column',
        position: 'relative' as 'relative'
    },
    label: {
        marginBottom: '0.5rem',
        fontSize: '0.875rem',
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500'
    },
    select: {
        width: '100%',
        padding: '0.75rem 1rem',
        background: 'rgba(255, 255, 255, 0.07)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '0.875rem',
        appearance: 'none' as 'none',
        WebkitAppearance: 'none' as 'none', 
        MozAppearance: 'none' as 'none',
        backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg width=\'14\' height=\'14\' fill=\'white\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M7 10l5 5 5-5z\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat' as 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        cursor: 'pointer' as 'pointer',
        '&:focus': {
          borderColor: '#60a5fa',
          outline: 'none',
          boxShadow: '0 0 0 3px rgba(96, 165, 250, 0.2)'
        }
    },
    buttonRow: {
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center' as 'center',
        padding: '0.75rem 0',
        width: '100%'
    },
    recordButton: (isRecording: boolean): React.CSSProperties => ({
        padding: '0.75rem 1.5rem',
        borderRadius: '50px',
        border: 'none',
        fontSize: '1rem',
        fontWeight: 500,
        cursor: 'pointer' as 'pointer',
        display: 'flex',
        alignItems: 'center' as 'center',
        gap: '0.5rem',
        background: isRecording ? 'linear-gradient(to right, #dc2626, #ef4444)' : 'linear-gradient(to right, #2563eb, #3b82f6)', 
        color: 'white',
        transition: 'all 0.3s ease',
        position: 'relative' as 'relative',
        boxShadow: isRecording ? '0 0 15px rgba(220, 38, 38, 0.5)' : '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
        ...(isRecording ? {
          animation: 'pulse 1.5s infinite',
          transform: 'scale(1.05)',
        } : {
          '&:hover': {
            transform: 'scale(1.02)'
          }
        }),
    }),
    transcriptGrid: {
        flexGrow: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        minHeight: 0
    },
    transcriptPanel: {
        display: 'flex',
        flexDirection: 'column' as 'column',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden' as 'hidden',
        minHeight: 0 
    },
    transcriptLabelGreen: {
        flexShrink: 0,
        marginBottom: '0.5rem',
        fontWeight: 500,
        color: '#6ee7b7'
    },
    transcriptLabelBlue: {
        flexShrink: 0,
        marginBottom: '0.5rem',
        fontWeight: 500,
        color: '#93c5fd'
    },
    conversationPanel: {
      flexGrow: 1,
      overflowY: 'auto' as 'auto',
      padding: '0.75rem',
      background: 'rgba(255, 255, 255, 0.07)',
      borderRadius: '8px',
        fontSize: '0.9rem',
      lineHeight: 1.6,
      color: 'white',
      scrollBehavior: 'smooth' as 'smooth',
      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
    },
    turnContainer: {
        marginBottom: '1rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px dashed rgba(255, 255, 255, 0.1)',
      transition: 'all 0.2s ease-in-out'
    },
    speakerLabel: {
      fontWeight: 'bold' as 'bold',
      fontSize: '0.85rem',
      marginBottom: '0.35rem',
        display: 'flex',
      alignItems: 'center' as 'center',
      gap: '5px',
      color: '#93c5fd'
    },
    turnText: {
      whiteSpace: 'pre-wrap' as 'pre-wrap',
      wordBreak: 'break-word' as 'break-word',
      transition: 'all 0.3s ease',
      padding: '8px 12px',
      borderRadius: '6px',
      backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
    errorDisplay: {
        position: 'fixed' as 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '32rem',
        width: 'calc(100% - 2rem)',
        zIndex: 50,
        background: 'linear-gradient(to right, #450a0a, #7f1d1d)',
        border: '1px solid #b91c1c',
        color: 'white',
        padding: '1rem 1.25rem',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center' as 'center',
        justifyContent: 'space-between' as 'space-between',
        backdropFilter: 'blur(10px)',
        animation: 'slideUp 0.3s ease-out'
    },
    errorCloseButton: {
        marginLeft: '1rem',
        color: '#fecaca',
        background: 'none',
        border: 'none',
        fontSize: '1.5rem',
        fontWeight: 'bold' as 'bold',
        cursor: 'pointer' as 'pointer',
        transition: 'all 0.2s ease',
        padding: '0.5rem',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          transform: 'scale(1.1)'
        }
    },
    participantInfo: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'flex-start' as 'flex-start',
      gap: '0.5rem',
      fontSize: '0.9rem',
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'left' as 'left',
      padding: '0.8rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
    },
    roleText: {
      fontWeight: 'bold' as 'bold',
      color: 'rgba(255, 255, 255, 1)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    }
  };

  const handleLeaveRoom = async () => {
    setIsLeaving(true);
    try {
      await leaveRoom(roomCode);
    } catch (error) {
      console.error('Error leaving room:', error);
      setErrorMessage('Failed to leave room. Please try again.');
    } finally {
      onLeaveRoom();
    }
  };

  // Helper function to determine which turn should be displayed in which panel
  const getDisplayData = (turn: ConversationTurn, isLeftPanel: boolean) => {
    const isMyTurn = turn.speakerUid === auth?.currentUser?.uid;
    const isTemp = turn.id.startsWith('temp-');
    
    // Get current language settings from component state
    const mySourceLang = sourceLanguage;
    const myTargetLang = targetLanguage;
    
    // Determine which text to display based on several factors:
    // 1. Is this my message or another user's?
    // 2. Which panel are we rendering (left=source, right=target)?
    // 3. What are the language settings of the source message?
    
    let displayText;
    
    if (isMyTurn) {
      // This is MY message
      if (isLeftPanel) {
        // Left panel = MY original language
        displayText = turn.originalText;
      } else {
        // Right panel = MY translated language 
        displayText = turn.translatedText;
      }
    } else {
      // This is ANOTHER user's message
      if (turn.originalLang === mySourceLang) {
        // The other user is speaking my source language
        if (isLeftPanel) {
          // Left panel = their original (my source language)
          displayText = turn.originalText;
        } else {
          // Right panel = their translation (my target language)
          displayText = turn.translatedText;
        }
      } else if (turn.targetLang === mySourceLang) {
        // The other user is speaking my target language
        if (isLeftPanel) {
          // Left panel = their translation (my source language)
          displayText = turn.translatedText;
        } else {
          // Right panel = their original (my target language)
          displayText = turn.originalText;
        }
      } else {
        // Languages don't match exactly - best effort display
        console.log(`[getDisplayData] Language mismatch for turn ${turn.id}: ` +
          `turn langs (${turn.originalLang}/${turn.targetLang}) vs my langs (${mySourceLang}/${myTargetLang})`);
        
        if (isLeftPanel) {
          // Try to display in my source language
          displayText = turn.originalLang === mySourceLang ? turn.originalText : turn.translatedText;
        } else {
          // Try to display in my target language
          displayText = turn.targetLang === myTargetLang ? turn.translatedText : turn.originalText;
        }
      }
    }
    
    // For temporary messages from current user
    if (isTemp && isMyTurn) {
      if (!isLeftPanel) {
        // In right panel, show "..." for my temp messages that aren't translated yet
        displayText = isTemp ? "..." : displayText;
      }
    }
    
    return { 
      displayText, 
      isTemp, 
      isMyTurn,
      isRecordingTemp: turn.id.startsWith('temp-current-speech-'),
      isTranslatingTemp: turn.id.startsWith('temp-translating-')
    };
  };

  // Add another useEffect to handle messages from other participants
  useEffect(() => {
    // For debugging purposes - log the current conversation turns
    if (conversationTurns.length > 0) {
      const myTurns = conversationTurns.filter(turn => 
        turn.speakerUid === auth?.currentUser?.uid);
      const otherTurns = conversationTurns.filter(turn => 
        turn.speakerUid !== auth?.currentUser?.uid);
      
      console.log(`[TranslationApp] Total turns: ${conversationTurns.length}, ` + 
        `My turns: ${myTurns.length}, Other turns: ${otherTurns.length}`);
    }
  }, [conversationTurns]);

  // Replace the typing status listener with the real-time speech listener
  useEffect(() => {
    if (!roomCode) return;
    console.log(`[TranslationApp] 👂 Setting up real-time speech listener for room: ${roomCode}`);
    const unsubscribe = listenToRealtimeSpeech(roomCode, (speeches) => {
      console.log('[TranslationApp] 📊 Raw speeches received callback:', speeches);
      setRawSpeechSnapshot(speeches);
      // DEBUG: show all speeches regardless of speaker
      setOtherUsersSpeaking(speeches);
    });
    return () => {
      console.log(`[TranslationApp] 🛑 Cleaning up real-time speech listener`);
      unsubscribe();
    };
  }, [roomCode]);

  // Replace the speech recognition handler with an improved version
  // This function updates the real-time speech when the user is speaking
  const updateLiveTranscription = (text: string) => {
    if (!isRecording) return;
    
    // Set the local active transcription
    setActiveTranscription(text);
    
    // Avoid sending duplicate updates
    if (text === lastSentSpeechRef.current) {
      return;
    }
    
    // Update the ref with the latest sent text
    lastSentSpeechRef.current = text;
    
    // Share speech with other users through Firebase
    const currentUser = auth?.currentUser;
    if (!currentUser || !myData || !database || !roomCode) {
      console.error("[TranslationApp] ❌ Missing required data for real-time update:", {
        hasAuth: !!auth,
        hasCurrentUser: !!currentUser,
        hasMyData: !!myData,
        hasDatabase: !!database,
        hasRoomCode: !!roomCode
      });
      return;
    }
    
    // Only send updates if text is not empty
    if (text.trim().length > 0) {
      console.log(`[TranslationApp] 🎙️ Sending real-time speech update: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
      
      // Prepare the speech data object
      const speechData = {
        text: text,
        speakerUid: currentUser.uid,
        speakerName: myData.name,
        speakerRole: myData.role,
        originalLang: sourceLanguage,
        targetLang: targetLanguage
      };
      
      // Log the exact data being sent
      console.log(`[TranslationApp] 🔍 Speech data being sent:`, JSON.stringify(speechData));
      
      // Try using the Firebase utility function first
      updateRealtimeSpeech(roomCode, speechData)
        .then((success) => {
          if (success) {
            console.log(`[TranslationApp] ✅ Successfully sent real-time speech update via updateRealtimeSpeech`);
          } else {
            console.error(`[TranslationApp] ❌ Failed to send real-time speech update via updateRealtimeSpeech, trying direct update`);
            
            // FALLBACK: Try direct Firebase update if the utility function fails
            try {
              // Create a simpler data structure for direct update
              const directData = {
                isTyping: true,
                text: text,
                speakerUid: currentUser.uid,
                speakerName: myData.name,
                speakerRole: myData.role,
                timestamp: Date.now()
              };
              
              const speechRef = ref(database as Database, `rooms/${roomCode}/realtimeSpeech/${currentUser.uid}`);
              set(speechRef, directData)
                .then(() => {
                  console.log(`[TranslationApp] ✅ Successfully sent real-time speech update via direct update`);
                })
                .catch(directError => {
                  console.error(`[TranslationApp] ❌ Failed direct real-time speech update:`, directError);
                });
            } catch (directUpdateError) {
              console.error(`[TranslationApp] ❌ Error during direct update:`, directUpdateError);
            }
          }
          
          // Update debug info
          setDebugInfo(prev => ({
            ...prev,
            lastSent: text,
            updateCount: prev.updateCount + 1
          }));
        }).catch((error: Error) => {
          console.error(`[TranslationApp] ❌ Error sending real-time speech:`, error);
        });
    } else {
      // If text is empty, clear the real-time speech
      clearRealtimeSpeech(roomCode, currentUser.uid)
        .then((success) => {
          console.log(`[TranslationApp] ✅ Successfully cleared real-time speech`);
        })
        .catch((error: Error) => {
          console.error(`[TranslationApp] ❌ Error clearing real-time speech:`, error);
        });
    }
  };

  // Fix the Test Firebase button with proper null checks
  const TestFirebaseButton = () => {
    return (
      <button
        onClick={() => {
          // Toggle testing state
          setIsTestingFirebase(prev => !prev);
          
          // If we're turning off testing, clear test data
          if (isTestingFirebase) {
            // Clear any test data that was previously set
            if (database && auth?.currentUser && roomCode) {
              const db = database as Database;
              const currentUser = auth.currentUser;
              
              // Clear the real-time speech data for current user
              const speechRef = ref(db, `rooms/${roomCode}/realtimeSpeech/${currentUser.uid}`);
              set(speechRef, null)
                .then(() => {
                  console.log("[TEST] Cleared test data successfully");
                  setOtherUsersSpeaking([]);
                })
                .catch(error => {
                  console.error("[TEST] Error clearing test data:", error);
                });
            }
            return;
          }
          
          // Test function to check Firebase real-time speech data
          console.log("[TEST] Checking Firebase real-time speech data");
          if (!database || !roomCode || !auth || !auth.currentUser) {
            console.error("[TEST] Database, auth, room code, or current user not available", {
              hasDatabase: !!database,
              hasAuth: !!auth,
              hasCurrentUser: auth ? !!auth.currentUser : false,
              hasRoomCode: !!roomCode
            });
            return;
          }
          
          // Apply proper type assertions
          const db = database as Database;
          const currentAuth = auth as Auth;
          const currentUser = currentAuth.currentUser;
          
          // First check if data exists
          const speechRef = ref(db, `rooms/${roomCode}/realtimeSpeech`);
          get(speechRef).then(snapshot => {
            if (snapshot.exists()) {
              console.log("[TEST] Real-time speech data found:", snapshot.val());
              
              // Test processing this data manually
              const data = snapshot.val();
              const speeches = Object.keys(data || {}).map(uid => ({
                speakerUid: uid,
                ...data[uid]
              }));
              
              console.log("[TEST] Processed speeches:", speeches);
              
              // Update UI with this data for testing
              if (speeches.length > 0 && currentUser) {
                setOtherUsersSpeaking(speeches.filter(
                  s => s.speakerUid !== currentUser.uid
                ));
              }
            } else {
              console.log("[TEST] No real-time speech data found");
              
              // If no data found, let's try to create a test entry
              if (myData && currentUser) {
                console.log("[TEST] Creating test real-time speech entry");
                
                // Create a test message
                const testData = {
                  text: "Test message from " + (myData?.name || "unknown user"),
                  speakerUid: currentUser.uid,
                  speakerName: myData?.name || "Test User",
                  speakerRole: myData?.role || "patient",
                  originalLang: sourceLanguage,
                  targetLang: targetLanguage
                };
                
                // Try to send it using our function
                updateRealtimeSpeech(roomCode, testData)
                  .then(success => {
                    console.log("[TEST] Result of sending test data:", success);
                    
                    // Now try writing directly to the database
                    if (!success) {
                      console.log("[TEST] Trying direct write to database");
                      const directRef = ref(db, `rooms/${roomCode}/realtimeSpeech/${currentUser.uid}`);
                      set(directRef, {
                        isTyping: true,
                        text: "Direct test message",
                        speakerUid: currentUser.uid,
                        speakerName: myData?.name || "Test User",
                        timestamp: Date.now()
                      })
                      .then(() => {
                        console.log("[TEST] Direct write successful");
                        // Check if it worked
                        return get(directRef);
                      })
                      .then(snap => {
                        console.log("[TEST] Direct write verification:", snap.exists() ? snap.val() : "Not found");
                      })
                      .catch(err => {
                        console.error("[TEST] Direct write error:", err);
                      });
                    }
                  });
              }
            }
          }).catch(error => {
            console.error("[TEST] Error fetching real-time speech data:", error);
          });
        }}
        style={{
          marginLeft: '1rem',
          padding: '0.5rem 0.75rem',
          background: isTestingFirebase ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          color: 'white',
          borderRadius: '8px',
          fontSize: '0.8rem',
          transition: 'all 0.2s ease'
        }}
      >
        {isTestingFirebase ? 'Clear Test Data' : 'Test Firebase'}
      </button>
    );
  };

  // Enhanced UI for real-time speech indicator with animations and better visual feedback
  const EnhancedRealtimeSpeechDisplay = () => {
    const [otherUserMessages, setOtherUserMessages] = useState<any[]>([]);
    const [fadeStates, setFadeStates] = useState<{[key: string]: 'in' | 'out'}>({});
    const prevMessagesRef = useRef<any[]>([]);
    
    // Listen for real-time speech updates from other users
    useEffect(() => {
      if (!database || !roomCode || !auth?.currentUser) return;
      
      // Apply proper type assertions
      const db = database as Database;
      const currentAuth = auth as Auth;
      const currentUser = currentAuth.currentUser;
      
      console.log('[EnhancedDisplay] Setting up listener for real-time speech');
      
      const speechRef = ref(db, `rooms/${roomCode}/realtimeSpeech`);
      const speechUnsubscribe = onValue(speechRef, (snapshot) => {
        try {
          if (!snapshot.exists()) {
            console.log('[EnhancedDisplay] No real-time speech data');
            
            // Handle case where all messages have been cleared
            // Set fade-out animation for any existing messages before removing them
            const currentUids = Object.keys(prevMessagesRef.current.reduce((acc, msg) => {
              acc[msg.uid] = true;
              return acc;
            }, {} as {[key: string]: boolean}));
            
            if (currentUids.length > 0) {
              setFadeStates(prev => {
                const newStates = {...prev};
                currentUids.forEach(uid => {
                  newStates[uid] = 'out';
                });
                return newStates;
              });
              
              // Remove messages after fade animation completes
              setTimeout(() => {
                setOtherUserMessages([]);
              }, 500); // Match this with CSS transition duration
            } else {
              setOtherUserMessages([]);
            }
            return;
          }
          
          const data = snapshot.val();
          console.log('[EnhancedDisplay] Raw data:', data);
          
          if (!currentUser) return;
          
          // Convert to array and filter out current user
          const currentUserId = currentUser.uid;
          const messages = Object.entries(data)
            .filter(([uid]) => uid !== currentUserId)
            .map(([uid, message]) => ({
              uid,
              ...(message as any)
            }));
          
          console.log('[EnhancedDisplay] Processed messages:', messages);
          
          // Track which UIDs are new and need fade-in animation
          const prevUids = new Set(prevMessagesRef.current.map(msg => msg.uid));
          const currentUids = new Set(messages.map(msg => msg.uid));
          
          // Find new UIDs to fade in
          const newUids = [...currentUids].filter(uid => !prevUids.has(uid));
          
          // Find removed UIDs to fade out
          const removedUids = [...prevUids].filter(uid => !currentUids.has(uid));
          
          // Update fade states
          if (newUids.length > 0 || removedUids.length > 0) {
            setFadeStates(prev => {
              const newStates = {...prev};
              
              newUids.forEach(uid => {
                newStates[uid] = 'in';
              });
              
              removedUids.forEach(uid => {
                newStates[uid] = 'out';
              });
              
              return newStates;
            });
          }
          
          // Update messages state
          if (messages.length > 0) {
            setOtherUserMessages(messages);
            prevMessagesRef.current = messages;
          } else if (removedUids.length > 0) {
            // If messages were removed, wait for fade-out animation
            setTimeout(() => {
              setOtherUserMessages([]);
              prevMessagesRef.current = [];
            }, 500); // Match with CSS transition
          } else {
            setOtherUserMessages([]);
            prevMessagesRef.current = [];
          }
        } catch (error) {
          console.error('[EnhancedDisplay] Error processing data:', error);
        }
      });
      
      return () => {
        console.log('[EnhancedDisplay] Cleaning up listener');
        speechUnsubscribe();
      };
    }, [database, roomCode, auth?.currentUser]);
    
    // If no messages, return null to avoid rendering empty div
    if (otherUserMessages.length === 0) {
      return null;
    }
    
    return (
      <div style={{
        marginTop: '15px',
        padding: '15px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <style>
          {`
            @keyframes pulse-subtle {
              0% { opacity: 1; box-shadow: 0 0 5px currentColor; }
              50% { opacity: 0.7; box-shadow: 0 0 10px currentColor; }
              100% { opacity: 1; box-shadow: 0 0 5px currentColor; }
            }
            
            .realtime-message {
              transition: all 0.5s ease;
              opacity: 0;
              transform: translateY(10px);
            }
            
            .realtime-message.fade-in {
              opacity: 1;
              transform: translateY(0);
            }
            
            .realtime-message.fade-out {
              opacity: 0;
              transform: translateY(-10px);
            }
            
            .pulse-animation {
              animation: pulse-subtle 2s infinite;
            }
            
            .realtime-indicator {
              display: inline-block;
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background-color: #2ecc71;
              margin-right: 8px;
              animation: pulse-subtle 1.5s infinite;
            }
            
            .realtime-translation-direction {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              font-size: 0.8em;
              color: rgba(255, 255, 255, 0.6);
              margin-top: 8px;
            }
            
            .realtime-translation-direction svg {
              height: 16px;
              width: 16px;
            }
          `}
        </style>
        
        <div className="realtime-header" style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '15px',
          padding: '10px 15px',
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          borderRadius: '8px',
          fontSize: '1em',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div className="realtime-indicator" style={{
            width: '12px',
            height: '12px'
          }}></div>
          <span style={{ 
            color: '#3498db', 
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
          }}>
            Real-time Speech Detection
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.8em',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            {otherUserMessages.length} active speaker{otherUserMessages.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {otherUserMessages.map((message, index) => (
          <div 
            key={message.uid} 
            className={`realtime-message fade-${fadeStates[message.uid] || 'in'}`}
            style={{
              padding: '15px',
              margin: '0 0 15px 0',
              backgroundColor: 'rgba(52, 152, 219, 0.2)',
              borderLeft: '4px solid #3498db',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(4px)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Add a subtle background pattern for visual interest */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.05,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              pointerEvents: 'none'
            }}></div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start',
              marginBottom: '12px',
              borderBottom: '1px solid rgba(52, 152, 219, 0.3)',
              paddingBottom: '10px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: message.speakerRole === 'doctor' ? '#3498db' : '#9b59b6',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px',
                fontWeight: 'bold',
                fontSize: '1.2em',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)'
              }}>
                {(message.speakerName || 'U').charAt(0).toUpperCase()}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 'bold',
                  color: message.speakerRole === 'doctor' ? '#3498db' : '#9b59b6',
                  fontSize: '1.1em'
                }}>
                  {message.speakerName || 'Unknown'} 
                  <span style={{ 
                    fontWeight: 'normal', 
                    marginLeft: '5px',
                    fontSize: '0.9em',
                    opacity: 0.8,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    {message.speakerRole || 'unknown'}
                  </span>
                </div>
                
                <div style={{ 
                  fontSize: '0.8em',
                  color: '#95a5a6',
                  marginTop: '3px'
                }}>
                  {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  }) : ''}
                </div>
              </div>
              
              <div className="pulse-animation" style={{
                padding: '5px 10px',
                marginLeft: 'auto',
                color: '#2ecc71',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.85em',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                borderRadius: '12px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#2ecc71',
                  marginRight: '5px',
                  boxShadow: '0 0 5px #2ecc71',
                  animation: 'pulse-subtle 1.5s infinite'
                }}></span>
                <span style={{ whiteSpace: 'nowrap' }}>Speaking now</span>
              </div>
            </div>
            
            <div style={{ 
              fontSize: '1.1em',
              lineHeight: '1.5',
              padding: '10px 15px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.95)',
              fontWeight: '500',
              position: 'relative'
            }}>
              {message.text || "(No text received)"}
            </div>
            
            {message.originalLang && message.targetLang && (
              <div className="realtime-translation-direction">
                <span>{message.originalLang}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span>{message.targetLang}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Create a debounce ref for update optimization
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Improved updateLiveTranscription function with debouncing and optimization
  const updateLiveTranscriptionImproved = (text: string) => {
    if (!isRecording) return;
    setActiveTranscription(text);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (text === lastSentSpeechRef.current) return;
      lastSentSpeechRef.current = text;
      if (!database || !auth?.currentUser || !myData || !roomCode) return;
      if (text.trim().length > 0) {
        const speechData = {
          text,
          speakerUid: auth.currentUser.uid,
          speakerName: myData.name,
          speakerRole: myData.role,
          originalLang: sourceLanguage,
          targetLang: targetLanguage,
          timestamp: Date.now()
        };
        const path = `rooms/${roomCode}/realtimeSpeech/${auth.currentUser.uid}`;
        console.log('[ImprovedUpdate] 💾 Writing to path:', path, 'with data:', speechData);
        const speechRef = ref(database as Database, path);
        set(speechRef, speechData)
          .then(() => console.log('[ImprovedUpdate] ✅ Update set at', path))
          .catch(error => console.error('[ImprovedUpdate] ❌ Error writing update:', error));
      } else {
        const speechRef = ref(database, `rooms/${roomCode}/realtimeSpeech/${auth.currentUser.uid}`);
        set(speechRef, null).then(() => console.log('[ImprovedUpdate] ✅ Cleared empty speech data'));        
      }
    }, 150);
  };

  // Real-time connection status indicator with improved visual feedback and recovery options
  const ConnectionStatusIndicator = () => {
    const [status, setStatus] = useState<'connected' | 'disconnected' | 'recording' | 'receiving' | 'reconnecting'>('disconnected');
    const [showRecoveryAttempt, setShowRecoveryAttempt] = useState(false);
    const [lastConnectionChange, setLastConnectionChange] = useState<number | null>(null);
    
    // Connection status history for recovery system
    const connectionStatusRef = useRef<{timestamp: number, status: boolean}[]>([]);
    const maxHistoryLength = 5; // Keep track of last 5 connection events
    const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Connection monitoring effect
    useEffect(() => {
      // Ensure all required values are available
      if (!database || !auth || !roomCode) return;
      
      // Use type assertion to tell TypeScript these values are not null
      const db = database as Database;
      const currentAuth = auth as Auth;
      const currentRoomCode = roomCode;
      
      const connectedRef = ref(db, '.info/connected');
      const unsubscribe = onValue(connectedRef, (snap) => {
        const isConnected = !!snap.val();
        const now = Date.now();
        
        // Update last connection change time
        setLastConnectionChange(now);
        
        // Set UI status
        if (isConnected) {
          setStatus(isRecording ? 'recording' : 'connected');
          // Reset recovery state when connected
          setShowRecoveryAttempt(false);
        } else {
          setStatus('disconnected');
        }
        
        // Add to history for recovery system
        connectionStatusRef.current.push({timestamp: now, status: isConnected});
        
        // Trim history if needed
        if (connectionStatusRef.current.length > maxHistoryLength) {
          connectionStatusRef.current = connectionStatusRef.current.slice(-maxHistoryLength);
        }
        
        console.log(`[ConnectionStatus] Connection status changed to: ${isConnected ? 'connected' : 'disconnected'}`);
        
        // Check for connection instability - recovery logic
        if (!isConnected && currentAuth.currentUser) {
          // If we've had multiple disconnects in a short time, implement recovery
          const disconnects = connectionStatusRef.current.filter(entry => !entry.status).length;
          
          if (disconnects > 1) {
            console.log('[ConnectionStatus] Detected connection instability, implementing recovery');
            
            // Show recovery attempt in UI
            setShowRecoveryAttempt(true);
            setStatus('reconnecting');
            
            // Clear any existing recovery timeout
            if (recoveryTimeoutRef.current) {
              clearTimeout(recoveryTimeoutRef.current);
              recoveryTimeoutRef.current = null;
            }
            
            // Schedule a recovery action
            recoveryTimeoutRef.current = setTimeout(() => {
              // Check if we're still disconnected
              if (connectionStatusRef.current.length > 0 && 
                  !connectionStatusRef.current[connectionStatusRef.current.length - 1].status) {
                
                const user = currentAuth.currentUser;
                if (user) {
                  const dbRef = ref(db, `rooms/${currentRoomCode}/recovery/${user.uid}`);
                  set(dbRef, {
                    timestamp: Date.now(),
                    status: 'recovery_attempt'
                  }).then(() => {
                    console.log('[ConnectionStatus] Recovery ping sent successfully');
                    
                    // After successful ping, try to restore any active real-time speech
                    if (isRecording && activeTranscription) {
                      console.log('[ConnectionStatus] Attempting to restore real-time speech after recovery');
                      updateLiveTranscriptionImproved(activeTranscription);
                    }
                    
                  }).catch(error => {
                    console.error('[ConnectionStatus] Recovery ping failed:', error);
                  });
                }
              }
            }, 2000); // Reduced wait time to 2 seconds for faster recovery
          }
        }
      });
      
      return () => unsubscribe();
    }, [database, isRecording, roomCode, auth, activeTranscription]);
    
    // Update status when recording changes
    useEffect(() => {
      if (status !== 'disconnected' && status !== 'reconnecting') {
        setStatus(isRecording ? 'recording' : 'connected');
      }
    }, [isRecording, status]);
    
    // Monitor other users' speeches
    useEffect(() => {
      if (otherUsersSpeaking.length > 0 && status !== 'disconnected' && status !== 'reconnecting') {
        setStatus('receiving');
      } else if (status === 'receiving' && otherUsersSpeaking.length === 0) {
        setStatus(isRecording ? 'recording' : 'connected');
      }
    }, [otherUsersSpeaking, isRecording, status]);
    
    const getStatusColor = () => {
      switch (status) {
        case 'connected': return '#3498db';  // Blue
        case 'recording': return '#e74c3c';  // Red
        case 'receiving': return '#2ecc71';  // Green
        case 'disconnected': return '#95a5a6';  // Gray
        case 'reconnecting': return '#f39c12';  // Orange
        default: return '#95a5a6';
      }
    };
    
    const getStatusText = () => {
      switch (status) {
        case 'connected': return 'Connected';
        case 'recording': return 'Recording';
        case 'receiving': return 'Receiving';
        case 'disconnected': return 'Disconnected';
        case 'reconnecting': return 'Reconnecting...';
        default: return 'Unknown';
      }
    };
    
    const getStatusIcon = () => {
      switch (status) {
        case 'connected': return '🟢';
        case 'recording': return '🔴';
        case 'receiving': return '📥';
        case 'disconnected': return '⚪';
        case 'reconnecting': return '🔄';
        default: return '❓';
      }
    };
    
    // Determine if we should show the extended panel with recovery options
    const shouldShowExtendedPanel = status === 'disconnected' || status === 'reconnecting' || showRecoveryAttempt;
    
    // Force reconnection manually
    const handleManualReconnect = () => {
      if (!database || !auth || !auth.currentUser || !roomCode) {
        console.log('[ConnectionStatus] Cannot reconnect - missing required data');
        return;
      }
      
      // Safe to use these variables now with proper type assertions
      const db = database as Database;
      const currentAuth = auth as Auth;
      const currentUser = currentAuth.currentUser;
      const currentRoomCode = roomCode;
      
      console.log('[ConnectionStatus] Manual reconnection attempt initiated');
      setStatus('reconnecting');
      
      const recoveryRef = ref(db, `rooms/${currentRoomCode}/recovery/${currentUser.uid}`);
      set(recoveryRef, {
        timestamp: Date.now(),
        status: 'manual_recovery'
      }).then(() => {
        console.log('[ConnectionStatus] Manual reconnection successful');
        // Will be updated automatically by the '.info/connected' listener
      }).catch(error => {
        console.error('[ConnectionStatus] Manual reconnection failed:', error);
        // After a short delay, revert to disconnected if still not connected
        setTimeout(() => {
          if (status === 'reconnecting') {
            setStatus('disconnected');
          }
        }, 3000);
      });
    };
    
    return (
      <>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            @keyframes pulse-status {
              0% { box-shadow: 0 0 0 0 rgba(${status === 'connected' ? '52, 152, 219' : 
                                status === 'recording' ? '231, 76, 60' : 
                                status === 'receiving' ? '46, 204, 113' : 
                                status === 'reconnecting' ? '243, 156, 18' : 
                                '149, 165, 166'}, 0.7); }
              70% { box-shadow: 0 0 0 10px rgba(${status === 'connected' ? '52, 152, 219' : 
                                  status === 'recording' ? '231, 76, 60' : 
                                  status === 'receiving' ? '46, 204, 113' : 
                                  status === 'reconnecting' ? '243, 156, 18' : 
                                  '149, 165, 166'}, 0); }
              100% { box-shadow: 0 0 0 0 rgba(${status === 'connected' ? '52, 152, 219' : 
                                  status === 'recording' ? '231, 76, 60' : 
                                  status === 'receiving' ? '46, 204, 113' : 
                                  status === 'reconnecting' ? '243, 156, 18' : 
                                  '149, 165, 166'}, 0); }
          }
          
          .status-indicator {
            transition: all 0.3s ease-in-out;
            animation: pulse-status 2s infinite;
          }
          
          .reconnecting-animation {
            animation: spin 1.5s linear infinite;
            display: inline-block;
          }
          
          .connection-status-panel {
            transition: all 0.3s ease-in-out;
            opacity: 0;
            transform: translateY(20px);
            pointer-events: none;
          }
          
          .connection-status-panel.visible {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
          }
        `}
      </style>
      
      {/* Main status indicator */}
      <div 
        onClick={() => shouldShowExtendedPanel ? null : setShowRecoveryAttempt(!showRecoveryAttempt)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease',
          cursor: shouldShowExtendedPanel ? 'default' : 'pointer',
          backdropFilter: 'blur(5px)'
        }}
      >
        <div 
          className="status-indicator"
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            transition: 'background-color 0.3s ease'
          }}
        ></div>
        <span style={{ 
          fontSize: '0.9em', 
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          {status === 'reconnecting' && (
            <span className="reconnecting-animation">🔄</span>
          )}
          {getStatusText()}
        </span>
        
        {!shouldShowExtendedPanel && (
          <span style={{ 
            marginLeft: '5px',
            fontSize: '0.8em',
            opacity: 0.7
          }}>
            (tap for details)
          </span>
        )}
      </div>
      
      {/* Extended connection panel with details and recovery options */}
      <div className={`connection-status-panel ${shouldShowExtendedPanel ? 'visible' : ''}`} style={{
        position: 'fixed',
        bottom: '70px',
        right: '20px',
        width: '280px',
        background: 'rgba(0, 0, 0, 0.85)',
        borderRadius: '12px',
        padding: '15px',
        color: 'white',
        zIndex: 999,
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${getStatusColor()}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '8px'
        }}>
          <h3 style={{ 
            margin: 0,
            fontSize: '1em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px' 
          }}>
            {getStatusIcon()} Connection Status
          </h3>
          <button 
            onClick={() => setShowRecoveryAttempt(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '1.2em',
              padding: '2px'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <p style={{ 
            margin: '0 0 8px 0',
            fontSize: '0.9em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>Status:</span> 
            <span style={{ 
              color: getStatusColor(),
              fontWeight: 'bold'
            }}>
              {getStatusText()}
            </span>
          </p>
          
          {lastConnectionChange && (
            <p style={{ 
              margin: '0 0 8px 0',
              fontSize: '0.9em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Last update:</span>
              <span>{new Date(lastConnectionChange).toLocaleTimeString()}</span>
            </p>
          )}
        </div>
        
        {(status === 'disconnected' || status === 'reconnecting') && (
          <div style={{ marginTop: '12px' }}>
            <p style={{ 
              margin: '0 0 10px 0', 
              fontSize: '0.85em',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: '1.4'
            }}>
              {status === 'disconnected' 
                ? 'Connection to the server has been lost. Try reconnecting to restore real-time features.' 
                : 'Attempting to reconnect to the server...'}
            </p>
            
            <button
              onClick={handleManualReconnect}
              disabled={status === 'reconnecting'}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: status === 'reconnecting' ? 'rgba(52, 152, 219, 0.3)' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: status === 'reconnecting' ? 'default' : 'pointer',
                fontSize: '0.9em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {status === 'reconnecting' ? (
                <>
                  <span className="reconnecting-animation">🔄</span>
                  Reconnecting...
                </>
              ) : (
                <>
                  🔄 Reconnect Now
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; box-shadow: 0 0 15px rgba(220, 38, 38, 0.5); }
            50% { opacity: 0.8; box-shadow: 0 0 25px rgba(220, 38, 38, 0.8); }
            100% { opacity: 1; box-shadow: 0 0 15px rgba(220, 38, 38, 0.5); }
          }
          
          .recording-pulse::before {
            content: '';
            display: inline-block;
            width: 12px;
            height: 12px;
            background-color: #10b981;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
            margin-right: 8px;
            box-shadow: 0 0 10px #10b981;
          }
          
          .typing-indicator::after {
            content: '';
            display: inline-block;
            width: 16px;
            height: 16px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='16' height='16'%3E%3Ccircle fill='%23fff' cx='20' cy='50' r='7'%3E%3Canimate attributeName='opacity' from='1' to='.3' dur='1s' repeatCount='indefinite' begin='0s'/%3E%3C/circle%3E%3Ccircle fill='%23fff' cx='50' cy='50' r='7'%3E%3Canimate attributeName='opacity' from='1' to='.3' dur='1s' repeatCount='indefinite' begin='0.2s'/%3E%3Ccircle fill='%23fff' cx='80' cy='50' r='7'%3E%3Canimate attributeName='opacity' from='1' to='.3' dur='1s' repeatCount='indefinite' begin='0.4s'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: center;
            margin-left: 8px;
            vertical-align: middle;
          }
          
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px -2px rgba(0,0,0,0.2);
          }
          
          button {
            transition: all 0.2s ease;
          }
          
          select:focus {
            border-color: #60a5fa !important;
            outline: none;
            box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2) !important;
          }
          
          .speech-bubble {
            position: relative;
            background: rgba(52, 152, 219, 0.2);
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
          }
          
          .speech-bubble:after {
            content: '';
            position: absolute;
            top: 100%;
            left: 20px;
            border: 10px solid transparent;
            border-top-color: rgba(52, 152, 219, 0.2);
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translate(-50%, 20px);
            }
            to {
              opacity: 1;
              transform: translate(-50%, 0);
            }
          }
          
          /* Transcript panel hover effects */
          .transcript-panel {
            transition: all 0.3s ease;
          }
          
          .transcript-panel:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
          }
          
          /* Error button hover */
          .error-close:hover {
            background-color: rgba(255, 255, 255, 0.1);
            transform: scale(1.1);
          }
        `}
      </style>
      
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>
          <span style={{ color: '#3b82f6' }}>Med</span>
          <span style={{ color: '#60a5fa' }}>Lingo</span>
        </h1>
        
        {/* Participant Info Display */}
        <div style={styles.participantInfo}>
          {myData ? (
            <span style={styles.roleText}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: myData.role === 'doctor' ? '#3b82f6' : '#8b5cf6' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Your Role: {myData.role.charAt(0).toUpperCase() + myData.role.slice(1)} ({myData.name})
            </span>
          ) : (
            <span>Loading your info...</span>
          )}
          {otherParticipantData ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: otherParticipantData.role === 'doctor' ? '#3b82f6' : '#8b5cf6' }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              Participant: {otherParticipantData.name} 
              <span style={{ 
                padding: '0.2rem 0.5rem', 
                backgroundColor: otherParticipantData.role === 'doctor' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                borderRadius: '4px',
                fontSize: '0.8rem'
              }}>
                {otherParticipantData.role.charAt(0).toUpperCase() + otherParticipantData.role.slice(1)}
              </span>
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5"></rect>
                <path d="M12 8v8"></path>
                <path d="M8 12h8"></path>
              </svg>
              Waiting for participant...
            </span>
          )}
        </div>

        <div style={styles.headerControls}>
          <div style={styles.roomCode} onClick={copyRoomCode} title="Click to copy">
            <span>Room: {roomCode}</span>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '1.1rem', width: '1.1rem', color: 'rgba(255,255,255,0.7)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <button onClick={handleLeaveRoom} style={styles.leaveButton} disabled={isLeaving}>
            {isLeaving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Leaving...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            Leave Room
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div style={styles.contentArea}>
        
        {/* Selectors Row */}
        <div style={styles.selectorsRow}>
          {/* Source Language */}
          <div style={styles.selectorContainer}>
            <label htmlFor="sourceLanguage" style={styles.label}>Source Language</label>
            <select id="sourceLanguage" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} disabled={isRecording} style={styles.select}>
              {languageOptions.map((lang) => (<option key={lang.value} value={lang.value} style={{ backgroundColor: '#2c3347' }}>{lang.label}</option>))}
            </select>
          </div>
          {/* Target Language */}
          <div style={styles.selectorContainer}>
            <label htmlFor="targetLanguage" style={styles.label}>Target Language</label>
            <select id="targetLanguage" value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} disabled={isRecording} style={styles.select}>
              {languageOptions.map((lang) => (<option key={lang.value} value={lang.value} style={{ backgroundColor: '#2c3347' }}>{lang.label}</option>))}
            </select>
          </div>
          {/* Voice Selector */}
          <div style={styles.selectorContainer}>
            <label htmlFor="voice" style={styles.label}>Voice</label>
            <select
              id="voice"
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = availableVoices.find(v => v.name === e.target.value);
                if (voice) setSelectedVoice(voice);
              }}
              disabled={availableVoices.length === 0 || isRecording}
              style={{...styles.select, opacity: (availableVoices.length === 0 || isRecording) ? 0.5 : 1}}
            >
              {availableVoices.length === 0 ? (
                <option value="" style={{ backgroundColor: '#2c3347' }}>No voices available</option>
              ) : (
                availableVoices.map((voice) => (
                  <option key={voice.name} value={voice.name} style={{ backgroundColor: '#2c3347' }}>
                    {voice.name} ({voice.lang})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Record Button Row */}
        <div style={styles.buttonRow}>
           <button
             onClick={toggleRecording}
             style={styles.recordButton(isRecording)}
             disabled={isTranslating}
           >
             {isRecording ? (
                 <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="recording-pulse">
                    <rect x="6" y="6" width="12" height="12" rx="1"></rect>
                  </svg>
                  Stop Recording
                 </>
             ) : (
                 <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                  </svg>
                  Start Recording
                 </>
             )}
           </button>
           {isTranslating && (
             <div style={{ 
               marginLeft: '1rem', 
               color: 'rgba(255,255,255,0.9)',
               display: 'flex',
               alignItems: 'center',
               gap: '0.5rem',
               padding: '0.5rem 1rem',
               background: 'rgba(59, 130, 246, 0.2)',
               borderRadius: '8px',
               boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
             }}>
               <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
               </svg>
               <span>Processing Translation...</span>
        </div>
           )}
           
           {/* Test Button for Firebase - can be styled or hidden as needed */}
           <TestFirebaseButton />
            </div>

        {/* Real-time Transcription Display */}
        {isRecording && activeTranscription && (
          <div className="speech-bubble" style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            padding: '15px',
            marginBottom: '20px',
            borderRadius: '10px',
            position: 'relative' as 'relative',
            animation: 'pulse 1.5s infinite'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '8px',
              color: 'rgba(16, 185, 129, 0.9)'
            }}>
              <span style={{ 
                marginRight: '8px',
                fontSize: '1.2rem' 
              }}>🎙️</span>
              <strong>Recording:</strong>
          </div>
            <div style={{
              fontSize: '1.1rem',
              lineHeight: '1.6',
              padding: '8px 12px',
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              borderRadius: '8px'
            }}>
              {activeTranscription}
            </div>
          </div>
        )}

        {/* Other Users' Real-time Speech Display */}
        {otherUsersSpeaking && otherUsersSpeaking.length > 0 && otherUsersSpeaking.map(speech => (
          <div key={speech.speakerUid} style={{
            padding: '15px',
            margin: '0 0 15px 0',
            backgroundColor: 'rgba(99, 102, 241, 0.15)', // Purple for other users
            borderLeft: '3px solid rgba(99, 102, 241, 0.7)',
            borderRadius: '4px',
            fontSize: '1.1rem',
            position: 'relative',
            animation: 'pulse 1.5s infinite'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '8px',
              color: 'rgba(99, 102, 241, 0.9)' // Purple text
            }}>
              <span style={{ marginRight: '8px' }}>🎙️</span>
              <strong>{speech.speakerName} ({speech.speakerRole}) is speaking:</strong>
                          </div>
            {speech.text || "(No text received)"}
                          </div>
        ))}

        {/* Transcript Grid */}
        <div style={styles.transcriptGrid}>
          {/* Panel 1: User's Language / Original */}
          <div className="transcript-panel" style={styles.transcriptPanel}>
            <label style={styles.transcriptLabelGreen}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Conversation ({sourceLangLabel})
            </label>
            {/* Replace textarea with scrollable div and map turns */}
            <div ref={panel1Ref} style={styles.conversationPanel}>
              {conversationTurns.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', textAlign: 'center', marginTop: '3rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 1rem', display: 'block' }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  Conversation will appear here...
                </p>
              )}
              {conversationTurns.map((turn) => {
                const { 
                  displayText, 
                  isTemp, 
                  isMyTurn,
                  isRecordingTemp, 
                  isTranslatingTemp 
                } = getDisplayData(turn, true); // true for left panel
                
                const speakerName = isMyTurn ? 'You' : turn.speakerName;
                const speakerRole = turn.speakerRole.charAt(0).toUpperCase() + turn.speakerRole.slice(1);
                
                // Choose style based on turn state
                let messageStyle = messageStyles.normal;
                if (isRecordingTemp) {
                  messageStyle = messageStyles.recording;
                } else if (isTranslatingTemp) {
                  messageStyle = messageStyles.translating;
                }
                
                return (
                  <div key={turn.id} className={`conversation-turn ${isMyTurn ? 'my-message' : 'other-message'}`} style={styles.turnContainer}>
                    <span style={{
                      ...styles.speakerLabel,
                      color: isMyTurn ? '#93c5fd' : '#c4b5fd',
                    }}>
                      {`${speakerName} (${speakerRole})`}
                      {isRecordingTemp && <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginLeft: '8px',
                        color: '#10b981'
                      }}>
                        <span className="recording-pulse"></span> Recording
                      </span>}
                      {isTranslatingTemp && <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginLeft: '8px',
                        color: '#3b82f6'
                      }}>
                        <span className="typing-indicator"></span> Translating
                      </span>}
                    </span>
                    <p className="message-bubble" style={{
                      ...styles.turnText,
                      ...messageStyle,
                      backgroundColor: isMyTurn ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                      borderLeft: isMyTurn ? '3px solid rgba(59, 130, 246, 0.5)' : '3px solid rgba(139, 92, 246, 0.5)',
                    }}>
                      {displayText || '(...)'}
                      {isTemp && !isTranslatingTemp && <span style={{color: 'rgba(255,255,255,0.5)', marginLeft: '4px'}}>...</span>}
                    </p>
                      </div>
                );
              })}
                   </div>
          </div>
          
          {/* Panel 2: Other Language / Translation */}
          <div className="transcript-panel" style={styles.transcriptPanel}>
            <label style={styles.transcriptLabelBlue}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Conversation ({targetLangLabel})
            </label>
             {/* Replace textarea with scrollable div and map turns */}
            <div ref={panel2Ref} style={styles.conversationPanel}>
              {conversationTurns.length === 0 && (
                 <p style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Conversation will appear here...</p>
              )}
              {conversationTurns.map((turn) => {
                const { 
                  displayText, 
                  isTemp, 
                  isMyTurn,
                  isRecordingTemp, 
                  isTranslatingTemp 
                } = getDisplayData(turn, false); // false for right panel
                
                const speakerName = isMyTurn ? 'You' : turn.speakerName;
                const speakerRole = turn.speakerRole.charAt(0).toUpperCase() + turn.speakerRole.slice(1);
                
                // Choose style based on turn state
                let messageStyle = messageStyles.normal;
                if (isRecordingTemp) {
                  messageStyle = messageStyles.recording;
                } else if (isTranslatingTemp) {
                  messageStyle = messageStyles.translating;
                }

                return (
                  <div key={turn.id} style={styles.turnContainer}>
                    <span style={styles.speakerLabel}>
                      {`${speakerName} (${speakerRole})`}
                      {isRecordingTemp && <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginLeft: '8px',
                        color: '#10b981'
                      }}>
                        <span className="recording-pulse"></span> Recording
                      </span>}
                      {isTranslatingTemp && <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginLeft: '8px',
                        color: '#3b82f6'
                      }}>
                        <span className="typing-indicator"></span> Translating
                      </span>}
                    </span>
                    <p style={{...styles.turnText, ...messageStyle}}>
                      {displayText || '(...)'}
                      {isTemp && <span style={{color: 'rgba(255,255,255,0.5)', marginLeft: '4px'}}>...</span>}
                    </p>
                  </div>
                );
              })}
          </div>
        </div> 
        </div>

      </div>

      {/* Error Display */}
      {errorMessage && (
        <div style={styles.errorDisplay}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f87171' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} style={styles.errorCloseButton} className="error-close">&times;</button>
        </div>
      )}

      {/* Realtime Speech Panel - now using the imported component */}
      <RealtimeSpeechPanel 
        isConnected={true} // You would want to derive this from your connection state
        otherUserSpeaking={otherUsersSpeaking.length > 0}
        otherUserText={otherUsersSpeaking.length > 0 ? otherUsersSpeaking[0].text || "" : ""}
      />

      {/* Enhanced Real-time Speech Display - only show if testing or there are actual messages */}
      {(otherUsersSpeaking.length > 0 || isTestingFirebase) && (
        <EnhancedRealtimeSpeechDisplay />
      )}

      {/* Connection Status Indicator */}
      <ConnectionStatusIndicator />

      {/* Debug: show raw realtimeSpeech snapshot */}
      {rawSpeechSnapshot && (
        <pre style={{
          background: 'rgba(0,0,0,0.5)',
          color: 'white',
          padding: '1rem',
          overflowX: 'auto',
          fontSize: '0.75rem'
        }}>
          {JSON.stringify(rawSpeechSnapshot, null, 2)}
        </pre>
      )}

    </div>
  );
};

export default TranslationApp; 
