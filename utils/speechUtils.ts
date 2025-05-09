import { translateText } from './translation';

// Get the appropriate SpeechRecognition implementation
export const getSpeechRecognition = (): any => {
  console.log('[getSpeechRecognition] Checking browser support...');
  if (typeof window === 'undefined') {
    console.log('[getSpeechRecognition] Window is undefined (SSR?). Returning null.');
    return null;
  }
  
  console.log('[getSpeechRecognition] window.SpeechRecognition:', !!window.SpeechRecognition);
  console.log('[getSpeechRecognition] window.webkitSpeechRecognition:', !!window.webkitSpeechRecognition);
  console.log('[getSpeechRecognition] window.msSpeechRecognition:', !!(window as any).msSpeechRecognition);

  // Prioritize standard and webkit implementations, known to work well.
  // Explicitly ignore msSpeechRecognition which might exist but be incompatible.
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('[getSpeechRecognition] No supported SpeechRecognition API found (standard/webkit). Returning null.');
    return null;
  }
  
  // Additional check: Ensure it's not the potentially problematic msSpeechRecognition 
  // even if it somehow got assigned (unlikely with the above logic, but safer)
  if ((SpeechRecognition as any) === (window as any).msSpeechRecognition) {
      console.warn('[getSpeechRecognition] msSpeechRecognition detected and ignored. Returning null.');
      return null;
  }

  // Check if we can actually instantiate it
  try {
    console.log('[getSpeechRecognition] Attempting to instantiate:', SpeechRecognition);
    const instance = new SpeechRecognition();
    if (instance) {
        console.log('[getSpeechRecognition] Instantiation successful. Returning constructor.', SpeechRecognition);
        return SpeechRecognition; // Return the constructor itself, not an instance
    }
    console.warn('[getSpeechRecognition] Instantiation returned falsy value. Returning null.');
    return null;
  } catch (e) {
      console.warn('[getSpeechRecognition] Instantiation failed with error. Returning null.', e);
      return null;
  }
};

// Get available voices for speech synthesis
export const getVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    
    // If voices are already available
    if (window.speechSynthesis.getVoices().length > 0) {
      resolve(window.speechSynthesis.getVoices());
      return;
    }
    
    // If voices aren't loaded yet, wait for the voiceschanged event
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
};

// Speak text using the provided voice
export const speakText = (text: string, voice: SpeechSynthesisVoice): void => {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  
  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;
    
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Speech synthesis error:', error);
  }
};

// Translate text using the OpenAI API via our backend route
export const translateWithAI = async (
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> => {
  if (!text.trim()) return ''; // Return early if text is empty

  console.log(`[translateWithAI] Starting translation from ${sourceLanguage} to ${targetLanguage}: "${text.substring(0, 50)}..."`);

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text, 
        sourceLanguage, 
        targetLanguage 
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      // Use the error message from the API response if available
      const errorMessage = data?.error || `API request failed with status ${response.status}`;
      console.error('[translateWithAI] Translation API error:', errorMessage, data?.details);
      // Construct an error object that might include status
      const error: any = new Error(errorMessage);
      error.status = response.status; 
      throw error; 
    }

    const data = await response.json();
    const translation = data.translation || '';

    console.log(`[translateWithAI] Translation successful - Result: "${translation.substring(0, 50)}..."`);
    return translation;

  } catch (error: any) {
    console.error('[translateWithAI] Translation error in speechUtils calling API:', error);
    // Re-throw the error so it can be caught by the component
    throw error; 
  }
};

// Save transcript to Firebase
export const saveTranscript = async (
  roomCode: string,
  transcriptData: any
): Promise<boolean> => {
  try {
    console.log("[saveTranscript] Saving transcript data:", transcriptData);
    
    // Validate all required fields are present
    if (!transcriptData.speakerUid || !transcriptData.speakerName || 
        !transcriptData.originalText || !transcriptData.translatedText ||
        !transcriptData.originalLang || !transcriptData.targetLang) {
      console.error("[saveTranscript] Missing required fields in transcript data");
      return false;
    }
    
    // Import firebase function to save transcript
    const { saveTranscript: firebaseSaveTranscript } = await import('./firebase');
    
    // Call the Firebase function with validated data
    return await firebaseSaveTranscript(
      roomCode,
      transcriptData
    );
  } catch (error) {
    console.error('[saveTranscript] Error saving transcript:', error);
    return false;
  }
};

// Get transcripts from Firebase
export const getTranscripts = async (
  roomCode: string
): Promise<{ original: string; translated: string; timestamp: number; }[]> => {
  try {
    // Simulate getting transcripts
    // In a real implementation, this would fetch from Firebase
    return new Promise((resolve) => {
      setTimeout(() => {
        // Import firebase functions to avoid circular dependencies
        import('./firebase').then(({ listenToTranscripts }) => {
          listenToTranscripts(roomCode, (transcripts) => {
            const formattedTranscripts = transcripts.map(transcript => ({
              original: transcript.originalText,
              translated: transcript.translatedText,
              timestamp: transcript.timestamp
            }));
            resolve(formattedTranscripts);
          });
        });
      }, 500);
    });
  } catch (error) {
    console.error('Error getting transcripts:', error);
    return [];
  }
}; 