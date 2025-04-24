'use client';

import React, { useState } from 'react';

type Role = 'doctor' | 'patient';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, role: Role) => void;
  isLoading: boolean;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!selectedRole) {
      setError('Please select your role.');
      return;
    }
    if (!agreed) {
      setError('You must agree to the terms to continue.');
      return;
    }
    onSubmit(name.trim(), selectedRole);
  };

  const handleClose = () => {
    // Reset state on close
    setName('');
    setSelectedRole(null);
    setAgreed(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  // Styles similar to Home component
  const styles = {
    overlay: {
      position: 'fixed' as 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center' as 'center',
      justifyContent: 'center' as 'center',
      zIndex: 1000,
    },
    modal: {
      background: 'linear-gradient(135deg, #1a1f2e 0%, #2c3347 100%)',
      padding: '2rem',
      borderRadius: '16px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
      maxWidth: '450px',
      width: '90%',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 'bold' as 'bold',
      marginBottom: '1.5rem',
      textAlign: 'center' as 'center',
      color: '#e5e7eb', // Light gray
    },
    inputGroup: {
      marginBottom: '1rem',
    },
    label: {
      display: 'block',
      marginBottom: '0.5rem',
      fontSize: '0.875rem',
      color: 'rgba(255, 255, 255, 0.7)',
    },
    input: {
      width: '100%',
      padding: '0.75rem 1rem',
      borderRadius: '10px',
      fontSize: '1rem',
      background: 'rgba(255, 255, 255, 0.07)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      boxSizing: 'border-box' as 'border-box',
      outline: 'none',
    },
    radioGroup: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1rem',
    },
    radioLabel: {
      display: 'flex',
      alignItems: 'center' as 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      borderRadius: '10px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      cursor: 'pointer' as 'pointer',
      flex: 1,
      transition: 'background-color 0.2s ease, border-color 0.2s ease',
    },
    radioInput: {
      display: 'none', // Hide actual radio button
    },
    checkboxGroup: {
      display: 'flex',
      alignItems: 'center' as 'center',
      gap: '0.5rem',
      marginBottom: '1.5rem',
      fontSize: '0.875rem',
      color: 'rgba(255, 255, 255, 0.8)',
    },
    checkbox: {
      width: '1rem',
      height: '1rem',
      cursor: 'pointer' as 'pointer',
    },
    error: {
      color: '#f87171', // Red-400
      fontSize: '0.875rem',
      marginBottom: '1rem',
      textAlign: 'center' as 'center',
    },
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
      justifyContent: 'flex-end' as 'flex-end',
    },
    button: (primary = false): React.CSSProperties => ({
      padding: '0.75rem 1.5rem',
      borderRadius: '10px',
      border: 'none',
      fontSize: '0.875rem',
      fontWeight: 500,
      cursor: 'pointer' as 'pointer',
      transition: 'background 0.2s ease, opacity 0.2s ease',
      background: primary
        ? 'linear-gradient(90deg, #2563eb, #3b82f6)'
        : 'rgba(255, 255, 255, 0.1)',
      color: primary ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
      opacity: isLoading ? 0.6 : 1,
      pointerEvents: isLoading ? 'none' : 'auto',
    }),
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside modal */}
        <h2 style={styles.title}>Create New Translation Room</h2>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.inputGroup}>
          <label htmlFor="name" style={styles.label}>Your Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your display name"
            style={styles.input}
            disabled={isLoading}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Select Your Role</label>
          <div style={styles.radioGroup}>
            {(['doctor', 'patient'] as Role[]).map((role) => (
              <label
                key={role}
                style={{
                  ...styles.radioLabel,
                  backgroundColor: selectedRole === role ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                  borderColor: selectedRole === role ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={selectedRole === role}
                  onChange={() => setSelectedRole(role)}
                  style={styles.radioInput}
                  disabled={isLoading}
                />
                {role.charAt(0).toUpperCase() + role.slice(1)} {/* Capitalize role */}
              </label>
            ))}
          </div>
        </div>

        <div style={styles.checkboxGroup}>
          <input
            id="agreement"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={styles.checkbox}
            disabled={isLoading}
          />
          <label htmlFor="agreement">
            I understand this is a prototype and agree to the terms (placeholder).
          </label>
        </div>

        <div style={styles.buttonGroup}>
          <button onClick={handleClose} style={styles.button()} disabled={isLoading}>
            Cancel
          </button>
          <button onClick={handleSubmit} style={styles.button(true)} disabled={isLoading || !agreed || !selectedRole || !name.trim()}>
            {isLoading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomModal; 