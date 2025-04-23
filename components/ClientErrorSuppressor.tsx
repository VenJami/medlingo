'use client';

import { useEffect } from 'react';

export default function ClientErrorSuppressor() {
  useEffect(() => {
    // This only runs on the client after hydration
    // Suppress specific console errors related to hydration
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Warning: Prop `data-kantu`')) {
        return;
      }
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Hydration failed because')) {
        return;
      }
      originalError(...args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  // This component doesn't render anything
  return null;
} 