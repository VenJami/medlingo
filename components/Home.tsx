'use client';

import { useState, useEffect } from 'react';
import { signInAnonymouslyWithFirebase, createRoom, joinRoom } from '../utils/firebase';
import TranslationApp from './TranslationApp';
import CreateRoomModal from './CreateRoomModal';

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
                disabled={!isAuthenticated || isLoading || isCreatingRoom}
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
                  opacity: !isAuthenticated || isLoading || isCreatingRoom ? '0.6' : '1',
                  pointerEvents: !isAuthenticated || isLoading || isCreatingRoom ? 'none' : 'auto',
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
                  disabled={isJoiningRoom}
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
                  disabled={isJoiningRoom}
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
                  disabled={!isAuthenticated || isLoading || isJoiningRoom || !inputRoomCode.trim() || !joinUserName.trim()}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1.5rem',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    background: 'linear-gradient(90deg, #059669, #10b981)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: !isAuthenticated || isLoading || isJoiningRoom || !inputRoomCode.trim() || !joinUserName.trim() ? '0.6' : '1',
                    pointerEvents: !isAuthenticated || isLoading || isJoiningRoom || !inputRoomCode.trim() || !joinUserName.trim() ? 'none' : 'auto',
                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  Join Room
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
      />
    </div>
  );
};

export default Home; 