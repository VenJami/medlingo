'use client';

import { useEffect, useState } from 'react';

interface LanguageSelectorProps {
  languages: Array<{ name: string; code: string }>;
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
  isDarkMode: boolean;
  disabled?: boolean;
}

const LanguageSelector = ({
  languages,
  selectedLanguage,
  onSelectLanguage,
  isDarkMode,
  disabled = false,
}: LanguageSelectorProps) => {
  return (
    <div className="relative inline-block">
      <select
        value={selectedLanguage}
        onChange={(e) => onSelectLanguage(e.target.value)}
        disabled={disabled}
        className={`pl-3 pr-8 py-1 text-sm rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isDarkMode 
            ? 'bg-gray-700 text-white border-gray-600' 
            : 'bg-white text-gray-900 border-gray-300'
        } border ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {languages.map((lang) => (
          <option 
            key={lang.code} 
            value={lang.code}
            className={isDarkMode ? 'bg-gray-700' : 'bg-white'}
          >
            {lang.name}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

export default LanguageSelector; 