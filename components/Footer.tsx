'use client';

import React from 'react';

const Footer: React.FC = () => {
  const container: React.CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto'
  };

  return (
    <footer style={{
      marginTop: 'auto',
      padding: '1.25rem 1rem',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.00), rgba(0,0,0,0.25))'
    }}>
      <div style={container}></div>
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


