'use client';

import { useState, useEffect } from 'react';
import { signInAnonymouslyWithFirebase, createRoom, joinRoom } from '../utils/firebase';
import TranslationApp from './TranslationApp';
import CreateRoomModal from './CreateRoomModal';
import { getSpeechRecognition } from '../utils/speechUtils';

type Role = 'doctor' | 'patient';

const Home = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);
  const [isCompatibilityModalOpen, setIsCompatibilityModalOpen] = useState(false);

  useEffect(() => {
    const authenticateUser = async () => {
      try {
        const user = await signInAnonymouslyWithFirebase();
        if (user) {
          setIsAuthenticated(true);
        } else {
          setError('Failed to authenticate. Please try again.');
        }
      } catch (err) {
        console.error('Authentication error:', err);
        setError('Failed to authenticate. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    authenticateUser();

    console.log('[Home useEffect] Running browser compatibility check...');
    // Check for browser compatibility on mount
    const SpeechRecognitionAPIConstructor = getSpeechRecognition(); // Renamed for clarity
    console.log('[Home useEffect] getSpeechRecognition returned:', SpeechRecognitionAPIConstructor);
    const supported = !!SpeechRecognitionAPIConstructor; // Check if constructor exists
    console.log('[Home useEffect] Browser supported check result:', supported);
    setIsBrowserSupported(supported);
    if (!supported) {
      console.log('[Home useEffect] Browser not supported, opening compatibility modal.');
      setIsCompatibilityModalOpen(true); // Show modal if not supported
    } else {
      console.log('[Home useEffect] Browser supported.');
    }
  }, []);

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleModalCreateSubmit = async (name: string, role: Role) => {
    setIsCreatingRoom(true);
    setError(null);
    try {
      const code = await createRoom(name, role);
      if (code) {
        setRoomCode(code);
        setIsCreateModalOpen(false);
      } else {
        setError('Failed to create room. Please try again.');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    const code = inputRoomCode.trim().toUpperCase();
    const name = joinUserName.trim();

    if (!code) {
      setError('Please enter a room code.');
      return;
    }
    if (!name) {
      setError('Please enter your name to join.');
      return;
    }

    setIsJoiningRoom(true);
    setError(null);
    try {
      const success = await joinRoom(code, name);
      if (success) {
        setRoomCode(code);
      } else {
        setError('Room not found, is full, or cannot be joined. Please check the code and try again.');
      }
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room. Please try again.');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleLeaveRoom = () => {
    setRoomCode(null);
  };

  if (roomCode) {
    return <TranslationApp roomCode={roomCode} onLeaveRoom={handleLeaveRoom} />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1f2e 0%, #2c3347 100%)',
      color: '#ffffff',
      padding: '2rem'
    }}>
      {isCompatibilityModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#2c3347',
            padding: '2rem',
            borderRadius: '12px',
            textAlign: 'center',
            maxWidth: '400px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <h2 style={{ marginBottom: '1rem', color: '#f87171' }}>Browser Not Supported</h2>
            <p style={{ marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              This application relies on browser features (Web Speech API) that are not fully supported in your current browser.
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              For the best experience, please use the latest version of **Google Chrome**.
            </p>
            <button
              onClick={() => setIsCompatibilityModalOpen(false)}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                background: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'background 0.2s ease'
              }}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      <div style={{
        maxWidth: '450px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          padding: '2.5rem 2rem',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            marginBottom: '0.75rem',
            background: 'linear-gradient(90deg, #60a5fa, #34d399)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            MedLIngo
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '2rem'
          }}>
            Real-time healthcare translation across language barriers
          </p>

          {isLoading ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              padding: '2rem 0' 
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid rgba(255, 255, 255, 0.1)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <>
              {!isBrowserSupported && (
                <div style={{
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  borderRadius: '8px',
                  background: 'rgba(234, 179, 8, 0.1)',
                  color: '#facc15',
                  fontSize: '0.9rem',
                  border: '1px solid rgba(234, 179, 8, 0.2)',
                  textAlign: 'center'
                }}>
                  Speech recognition features require Google Chrome for full support. Key functionality will be disabled.
                </div>
              )}
              {error && (
                <div style={{
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  borderRadius: '8px',
                  background: 'rgba(220, 38, 38, 0.1)',
                  color: '#ef4444',
                  fontSize: '0.9rem',
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleOpenCreateModal}
                disabled={!isAuthenticated || isLoading || isCreatingRoom || !isBrowserSupported}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.5rem',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '1.5rem',
                  opacity: !isAuthenticated || isLoading || isCreatingRoom || !isBrowserSupported ? '0.6' : '1',
                  pointerEvents: !isAuthenticated || isLoading || isCreatingRoom || !isBrowserSupported ? 'none' : 'auto',
                  boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
                }}
              >
                Create Translation Room
              </button>

              <div style={{
                position: 'relative',
                textAlign: 'center',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '1px',
                  background: 'rgba(255, 255, 255, 0.1)'
                }}></div>
                <span style={{
                  position: 'relative',
                  padding: '0 0.75rem',
                  background: 'rgba(44, 51, 71, 0.8)',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.875rem'
                }}>
                  Or join existing room
                </span>
              </div>

              <div>
                <input
                  type="text"
                  value={inputRoomCode}
                  onChange={(e) => setInputRoomCode(e.target.value)}
                  placeholder="Enter room code"
                  disabled={isJoiningRoom || !isBrowserSupported}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    marginBottom: '1rem',
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                />
                <input
                  type="text"
                  value={joinUserName}
                  onChange={(e) => setJoinUserName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={isJoiningRoom || !isBrowserSupported}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    marginBottom: '1rem',
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={!isAuthenticated || isLoading || isJoiningRoom || !isBrowserSupported}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1.5rem',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    background: 'linear-gradient(90deg, #10b981, #34d399)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: !isAuthenticated || isLoading || isJoiningRoom || !isBrowserSupported ? '0.6' : '1',
                    pointerEvents: !isAuthenticated || isLoading || isJoiningRoom || !isBrowserSupported ? 'none' : 'auto',
                    boxShadow: '0 4px 10px rgba(52, 211, 153, 0.3)'
                  }}
                >
                  {isJoiningRoom ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleModalCreateSubmit}
        isLoading={isCreatingRoom}
        disabled={!isBrowserSupported}
      />
    </div>
  );
};

export default Home; 