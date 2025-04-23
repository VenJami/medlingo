'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database'; 
import { User } from 'firebase/auth';
import { database, auth, listenToRoomData, listenToTranscripts, updateTranscript } from '../utils/firebase';

import { 
  getSpeechRecognition, 
  getVoices, 
  speakText, 
  translateWithAI, 
  saveTranscript,
  getTranscripts
} from '../utils/speechUtils';

type Role = 'doctor' | 'patient';
interface RoomData {
  createdAt: number;
  createdBy: string;
  participants: {
    [userId: string]: {
      joinedAt: number;
      isActive: boolean;
    };
  };
  rolesAssigned?: boolean;
  roles?: {
    [userId: string]: Role;
  };
}

interface TranscriptData {
  id: string;
  uid: string;
  timestamp: number;
  originalText: string;
  translatedText: string;
  language: string;
}

interface TranscriptHistoryEntry {
  original: string;
  translated: string;
  timestamp: number;
}

interface TranslationAppProps {
  roomCode: string;
  onLeaveRoom: () => void;
}

const TranslationApp = ({ roomCode, onLeaveRoom }: TranslationAppProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('es-ES');
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptHistoryEntry[]>([]);

  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const recognitionRef = useRef<any>(null);
  const accumulatedTextRef = useRef<string>('');

  const languageOptions = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'es-ES', label: 'Spanish (Spain)' },
    { value: 'fr-FR', label: 'French (France)' },
    { value: 'de-DE', label: 'German (Germany)' },
    { value: 'ja-JP', label: 'Japanese (Japan)' },
    { value: 'zh-CN', label: 'Chinese (Simplified)' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
    { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' }
  ];

  useEffect(() => {
    const loadHistory = async () => {
        try {
            const history = await getTranscripts(roomCode);
            setTranscriptHistory(history);
            if (history.length > 0) {
              setTranslatedText(history[history.length - 1].translated);
            }
        } catch (error) {
            console.error("Error loading transcript history:", error);
            setErrorMessage("Failed to load history.");
        }
    };
    loadHistory();
  }, [roomCode]);

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
          let finalTranscriptPart = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscriptPart += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscriptPart) {
            setTranscript(prev => prev + finalTranscriptPart);
            accumulatedTextRef.current += finalTranscriptPart;
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          let userFriendlyError = `Speech recognition error: ${event.error}`;
          if (event.error === 'no-speech') userFriendlyError = 'No speech detected.';
          else if (event.error === 'audio-capture') userFriendlyError = 'Microphone error.';
          else if (event.error === 'not-allowed') userFriendlyError = 'Microphone access denied.';
          
          setErrorMessage(userFriendlyError);
          setIsRecording(false);
          accumulatedTextRef.current = ''; 
        };

        recognition.onend = () => {
          if (isRecording && recognitionRef.current) {
             try {
                 setTimeout(() => {
                     if (isRecording && recognitionRef.current && !['not-allowed', 'service-not-allowed'].includes(recognitionRef.current.error)) {
                         recognitionRef.current.start();
                     } else {
                         setIsRecording(false);
                     }
                 }, 300);
             } catch (e) {
                 console.error('Error restarting recognition:', e);
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
  }, [sourceLanguage, isRecording]);

  const toggleRecording = () => {
    try {
      if (isRecording) {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setIsRecording(false); 
        
        const textToTranslate = accumulatedTextRef.current.trim();
        if (textToTranslate) {
          console.log("[Stop Record] Translating full transcript:", textToTranslate);
          handleTranslation(textToTranslate); 
        }
        accumulatedTextRef.current = '';
  
      } else {
        setErrorMessage(null);
        setTranscript('');
        setTranslatedText('');
        accumulatedTextRef.current = '';
        
        if (!recognitionRef.current) {
          console.warn("Recognition not ready, check useEffect setup.");
           setErrorMessage("Speech recognition not ready. Please wait or refresh.");
          return; 
        }
  
        recognitionRef.current.lang = sourceLanguage;
        recognitionRef.current.start();
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      setErrorMessage('Failed to toggle recording. Check mic/permissions.');
      setIsRecording(false);
      accumulatedTextRef.current = '';
    }
  };
  
  const handleTranslation = async (textToTranslate: string) => {
    if (!textToTranslate) return;
    console.log("[handleTranslation] Called with text:", textToTranslate); 
    setIsTranslating(true);
    setTranslatedText('(Translating...)');
  
    try {
      const translatedResult = await translateWithAI(
        textToTranslate, 
        sourceLanguage,
        targetLanguage
      );
      
      if (translatedResult) {
         setTranslatedText(translatedResult);
         const newHistoryEntry = { 
             original: textToTranslate, 
             translated: translatedResult, 
             timestamp: Date.now() 
         };
         setTranscriptHistory(prev => [...prev, newHistoryEntry]);
         await saveTranscript(roomCode, textToTranslate, translatedResult);

      } else {
         throw new Error("Translation result was empty.");
      }
  
    } catch (error: any) {
      console.error('Translation API error:', error);
      setErrorMessage(`Translation Error: ${error.message || 'Unknown error'}`);
      setTranslatedText('(Translation failed)');
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

  // --- Inline Styles (Let TypeScript infer the main type) ---
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
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    },
    title: {
      fontSize: '1.75rem',
      fontWeight: 'bold' as 'bold',
      color: '#60a5fa' // Using a fixed blue, similar to Home.tsx gradient
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
        padding: '0.5rem 0.75rem',
        borderRadius: '8px',
        fontSize: '0.875rem',
        fontFamily: 'monospace',
        cursor: 'pointer' as 'pointer'
    },
    leaveButton: {
        padding: '0.5rem 1rem',
        background: '#dc2626', 
        border: 'none', 
        color: 'white', 
        borderRadius: '8px', 
        cursor: 'pointer' as 'pointer',
        fontSize: '0.875rem'
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
        gap: '1rem'
    },
    selectorContainer: {
        display: 'flex',
        flexDirection: 'column' as 'column'
    },
    label: {
        marginBottom: '0.25rem',
        fontSize: '0.875rem',
        color: 'rgba(255, 255, 255, 0.7)'
    },
    select: {
        width: '100%',
        padding: '0.75rem',
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
        backgroundPosition: 'right 0.75rem center'
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
        background: isRecording ? '#dc2626' : '#2563eb', 
        color: 'white',
        transition: 'background 0.2s ease'
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
        color: '#6ee7b7' // Greenish
    },
    transcriptLabelBlue: {
        flexShrink: 0,
        marginBottom: '0.5rem',
        fontWeight: 500,
        color: '#93c5fd' // Bluish
    },
    textarea: {
        width: '100%',
        height: '100%',
        background: 'transparent',
        border: 'none',
        borderRadius: '0',
        color: 'white',
        fontSize: '0.9rem',
        lineHeight: 1.5, 
        resize: 'none' as 'none',
        outline: 'none',
        overflowY: 'auto' as 'auto'
    },
    historyContainer: {
        flexShrink: 0,
        marginTop: '1rem',
        maxHeight: '10rem',
        overflowY: 'auto' as 'auto',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        padding: '0',
        border: '1px solid rgba(255, 255, 255, 0.08)'
    },
    historyTitle: {
        fontSize: '1.1rem',
        fontWeight: 500,
        marginBottom: '1rem',
        color: 'rgba(255, 255, 255, 0.9)',
        position: 'sticky' as 'sticky',
        top: 0,
        background: 'inherit',
        padding: '0.75rem 0.5rem',
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    },
    historyEntry: {
        marginBottom: '1rem', // Increased from 0.75rem
        paddingBottom: '1rem', // Increased from 0.75rem
        paddingLeft: '0.5rem', // Added left padding
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    },
    historyTime: {
        fontSize: '0.75rem',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: '0.5rem' // Increased from 0.25rem
    },
    historyGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        fontSize: '0.8rem'
    },
    historyLabel: {
        fontWeight: 500,
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: '0.25rem'
    },
    historyText: {
        color: 'rgba(255, 255, 255, 0.9)',
        wordBreak: 'break-word' as 'break-word'
    },
    errorDisplay: {
        position: 'fixed' as 'fixed',
        bottom: '1.25rem', // Corresponds to bottom-5
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '28rem', // Corresponds to max-w-md
        width: 'calc(100% - 2rem)', // Allow some padding
        zIndex: 50,
        background: '#450a0a', // Corresponds to bg-red-800
        border: '1px solid #7f1d1d', // Corresponds to border-red-600
        color: 'white',
        padding: '0.75rem 1rem', // Corresponds to px-4 py-3
        borderRadius: '0.5rem', // Corresponds to rounded-lg
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // Corresponds to shadow-lg
        display: 'flex',
        alignItems: 'center' as 'center',
        justifyContent: 'space-between' as 'space-between'
    },
    errorCloseButton: {
        marginLeft: '1rem',
        color: '#fecaca', // Corresponds to text-red-200
        background: 'none',
        border: 'none',
        fontSize: '1.25rem',
        fontWeight: 'bold' as 'bold',
        cursor: 'pointer' as 'pointer'
    }
  };

  return (
    <div style={styles.container}>
      
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>MedLingo</h1>
        <div style={styles.headerControls}>
          <div style={styles.roomCode} onClick={copyRoomCode} title="Click to copy">
            <span>Room: {roomCode}</span>
            {/* Basic Copy Icon SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '1rem', width: '1rem', color: 'rgba(255,255,255,0.6)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <button onClick={onLeaveRoom} style={styles.leaveButton}>
            Leave Room
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
           >
             {isRecording ? (
                 // Basic Stop Icon
                 <><span style={{display: 'inline-block', width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '2px'}}></span> Stop Recording</> 
             ) : (
                 <>🎙️ Start Recording</>
             )}
           </button>
        </div>

        {/* Transcript Grid */}
        <div style={styles.transcriptGrid}>
          {/* Original Transcript Panel */}
          <div style={styles.transcriptPanel}>
            <label htmlFor="transcript" style={styles.transcriptLabelGreen}>
              Original ({languageOptions.find(l => l.value === sourceLanguage)?.label})
            </label>
            {/* Wrap textarea in a div for padding */}
            <div style={{ flexGrow: 1, overflow: 'hidden', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.07)', borderRadius: '8px' }}>
              <textarea
                id="transcript"
                readOnly
                value={transcript}
                placeholder="Your spoken text will appear here..."
                style={{...styles.textarea, padding: 0, height: '100%', width: '100%', background: 'transparent' }}
              />
            </div>
          </div>
          {/* Translated Transcript Panel */}
          <div style={styles.transcriptPanel}>
            <label htmlFor="translatedText" style={styles.transcriptLabelBlue}>
                Translation ({languageOptions.find(l => l.value === targetLanguage)?.label})
            </label>
            {/* Wrap textarea in a div for padding */}
            <div style={{ flexGrow: 1, overflow: 'hidden', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.07)', borderRadius: '8px' }}>
              <textarea
                id="translatedText"
                readOnly
                value={translatedText}
                placeholder="Translation will appear here..."
                style={{...styles.textarea, padding: 0, height: '100%', width: '100%', background: 'transparent' }}
              />
            </div>
          </div>
        </div>

         {/* Conversation History */}
        <div style={styles.historyContainer}>
          <h3 style={styles.historyTitle}>Conversation History</h3>
          <div style={{ padding: '0.5rem 0.5rem 1rem 0.5rem' }}>
            {transcriptHistory.length > 0 ? (
                transcriptHistory.map((entry, index) => (
                    <div key={entry.timestamp + index} style={styles.historyEntry}>
                       <div style={styles.historyTime}>{getFormattedTime(entry.timestamp)}</div>
                       <div style={styles.historyGrid}>
                          <div>
                             <p style={styles.historyLabel}>Original</p>
                             <p style={styles.historyText}>{entry.original}</p>
                          </div>
                          <div>
                             <p style={styles.historyLabel}>Translation</p>
                             <p style={styles.historyText}>{entry.translated}</p>
                          </div>
                      </div>
                   </div>
                ))
            ) : (
                <p style={{textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', paddingTop: '1rem'}}>No history yet.</p>
            )}
          </div>
        </div> 
      </div>

      {/* Error Display */}
      {errorMessage && (
        <div style={styles.errorDisplay}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={styles.errorCloseButton}>&times;</button>
        </div>
      )}

    </div>
  );
};

export default TranslationApp; 