import { FC } from 'react';

interface RealtimeSpeechPanelProps {
  isConnected: boolean;
  otherUserSpeaking: boolean;
  otherUserText: string;
}

const RealtimeSpeechPanel: FC<RealtimeSpeechPanelProps> = ({ 
  isConnected, 
  otherUserSpeaking, 
  otherUserText 
}) => {
  // If no one is speaking and we're connected, don't render anything
  if (!otherUserSpeaking && isConnected) {
    return null;
  }

  return (
    <div style={{
      margin: '1rem 0',
      padding: '1rem',
      borderRadius: '8px',
      backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
      color: 'white',
    }}>
      {!isConnected && (
        <div style={{ marginBottom: '0.5rem', color: 'rgba(239, 68, 68, 0.9)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '0.5rem', verticalAlign: 'middle' }}>
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span>Connection lost. Waiting for reconnection...</span>
        </div>
      )}
      
      {otherUserSpeaking && (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '0.5rem',
            color: 'rgba(16, 185, 129, 0.9)'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
            <strong>Participant is speaking:</strong>
          </div>
          <p style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            margin: 0
          }}>
            {otherUserText || "..."}
          </p>
        </div>
      )}
    </div>
  );
};

export default RealtimeSpeechPanel; 