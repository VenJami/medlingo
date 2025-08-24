'use client';

import React from 'react';

const Header: React.FC = () => {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(26, 31, 46, 0.7)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem'
        }}
      >
        <div
          style={{
            fontWeight: 700,
            letterSpacing: 0.3,
            background: 'linear-gradient(90deg, #60a5fa, #34d399)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          MedLIngo
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="#how-it-works" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '0.95rem' }}>How it works</a>
          <a href="#faq" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '0.95rem' }}>FAQ</a>
          <a href="#connect" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '0.95rem' }}>Connect</a>
        </div>
      </nav>
    </header>
  );
};

export default Header;


