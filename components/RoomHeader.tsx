'use client';

interface RoomHeaderProps {
  roomCode: string;
  onLeaveRoom: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const RoomHeader = ({
  roomCode,
  onLeaveRoom,
  isDarkMode,
  onToggleDarkMode
}: RoomHeaderProps) => {
  return (
    <header className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">MedLIngo</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Room:</span>
            <span className="text-sm font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 py-1 px-2 rounded">
              {roomCode}
            </span>
          </div>
          <button
            onClick={onLeaveRoom}
            className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
          >
            Leave Room
          </button>
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700 text-yellow-300' : 'bg-gray-200 text-gray-800'}`}
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default RoomHeader; 