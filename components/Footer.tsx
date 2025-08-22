'use client';

import React from 'react';

const Footer: React.FC = () => {
  const container: React.CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1.25rem',
    alignItems: 'start'
  };

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '1rem',
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
  };

  const pill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: '#93c5fd',
    textDecoration: 'none',
    background: 'linear-gradient(180deg, rgba(59,130,246,0.18), rgba(59,130,246,0.10))',
    border: '1px solid rgba(59,130,246,0.35)',
    padding: '0.5rem 0.75rem',
    borderRadius: 999,
    transition: 'transform 0.15s ease, background 0.2s ease'
  };

  return (
    <footer style={{
      marginTop: 'auto',
      padding: '1.25rem 1rem',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.00), rgba(0,0,0,0.25))'
    }}>
      <div style={container}>
        <div style={card}>
          <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: 6 }}>MedLIngo</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: 1.65 }}>
            Real-time speech-to-text and translation for healthcare conversations.
          </div>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <li>Select Source and Target languages</li>
            <li>Tap <strong>Start Recording</strong>, speak, then tap <strong>Stop</strong></li>
            <li>View original and translated turns in the panels</li>
          </ul>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#a7f3d0', marginBottom: 6 }}>About</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: 1.65 }}>
            Personal prototype for demonstration and educational use. Not a medical device. Do not use for diagnosis or treatment.
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="https://www.linkedin.com/in/ravenjaminal/" target="_blank" rel="noreferrer" style={pill}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V23h-4V8zm7 0h3.8v2.05h.05c.53-1 1.84-2.05 3.79-2.05 4.05 0 4.8 2.67 4.8 6.14V23h-4v-7.3c0-1.74-.03-3.98-2.43-3.98-2.44 0-2.81 1.9-2.81 3.86V23h-4V8z"/>
              </svg>
              LinkedIn
            </a>
            <a href="https://github.com/VenJami" target="_blank" rel="noreferrer" style={pill}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .5a12 12 0 00-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.35-1.75-1.35-1.75-1.11-.76.08-.75.08-.75 1.23.09 1.88 1.26 1.88 1.26 1.09 1.86 2.86 1.33 3.56 1.02.11-.79.43-1.33.78-1.63-2.67-.3-5.48-1.34-5.48-5.95 0-1.31.47-2.37 1.24-3.21-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.64.24 2.86.12 3.16.77.84 1.24 1.9 1.24 3.21 0 4.62-2.81 5.65-5.49 5.95.45.39.84 1.15.84 2.32v3.44c0 .32.22.69.83.57A12 12 0 0012 .5z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#fde68a', marginBottom: 6 }}>Disclaimer</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', lineHeight: 1.65 }}>
            This personal project may use free, rate-limited AI models. If you see a rate-limit notice, wait 1–2 minutes and try again.
          </div>
        </div>
      </div>
      <div style={{
        maxWidth: 1200,
        margin: '0.75rem auto 0',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '0.8rem',
        textAlign: 'center'
      }}>
        © {new Date().getFullYear()} MedLIngo • Built by Raven
      </div>
    </footer>
  );
};

export default Footer;


