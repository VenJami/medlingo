'use client';

import { useEffect, useState } from 'react';

interface TranscriptPanelProps {
  text: string;
  isDarkMode: boolean;
  isLoading?: boolean;
  onSpeak: () => void;
}

const TranscriptPanel = ({
  text,
  isDarkMode,
  isLoading = false,
  onSpeak,
}: TranscriptPanelProps) => {
  return (
    <div className={`relative p-4 rounded-lg shadow-sm h-64 ${
      isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-300'
    }`}>
      <div className="h-full flex flex-col">
        <div className="flex-grow relative">
          <div className={`w-full h-full rounded-md ${
            isDarkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-gray-50 text-gray-800 border-gray-300'
          } border p-3`}>
            <textarea
              value={text}
              readOnly
              className="w-full h-full resize-none bg-transparent focus:outline-none"
              placeholder="Text will appear here..."
            />
          </div>
          
          {isLoading && (
            <div className={`absolute inset-0 flex items-center justify-center rounded-md ${
              isDarkMode ? 'bg-gray-800 bg-opacity-70' : 'bg-white bg-opacity-70'
            }`}>
              <div className="flex space-x-2">
                <div className="h-3 w-3 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="h-3 w-3 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                <div className="h-3 w-3 bg-blue-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-3 flex justify-end">
          <button
            onClick={onSpeak}
            disabled={!text.trim() || isLoading}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
              isDarkMode 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            Speak
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptPanel; 