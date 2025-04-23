# System Patterns: Healthcare Translation Web App with Generative AI

## Architecture Overview
Healthcare Translation Web App with Generative AI follows a client-side web application architecture with API integrations and real-time multi-device communication. The frontend handles user interactions, speech recognition, and display, while external APIs manage translation and text-to-speech conversion. Firebase Realtime Database provides the infrastructure for room-based real-time communication between patients and healthcare providers. This architecture enables rapid development while maintaining performance for real-time interactions across devices.

## Design Patterns
- **Observer Pattern**: For real-time updates between speech recognition and translation
- **Facade Pattern**: To simplify interactions with complex APIs (speech recognition, translation)
- **Strategy Pattern**: For switching between different language translation approaches
- **Pub/Sub Pattern**: For real-time communication between devices via Firebase
- **Singleton Pattern**: For managing room connections and session state

## Component Relationships
The application consists of several key components:
1. **Speech Recognition Module**: Captures voice input and converts to text
2. **Translation Service**: Processes text and returns translations
3. **Text-to-Speech Module**: Converts translated text to audio
4. **UI Interface**: Handles user interactions and displays transcripts
5. **Language Management**: Controls language selection and configuration
6. **Room Management**: Handles creating and joining translation sessions
7. **Real-time Communication**: Manages data synchronization between devices

These components interact through events and callbacks to maintain real-time functionality.

## Data Flow
### Single-Device Flow
1. User speaks into device microphone
2. Speech Recognition API converts speech to text
3. Text is displayed in original language transcript
4. Text is sent to Translation API
5. Translated text is returned and displayed
6. When requested, Text-to-Speech converts translation to audio

### Multi-Device Flow
1. User A creates or joins a translation room
2. User B joins the same room via a unique code
3. User A speaks into their device microphone
4. Speech Recognition API converts speech to text on User A's device
5. Text is displayed in User A's original language transcript
6. Text is synchronized to User B's device via Firebase Realtime Database
7. Text is displayed in User B's original language transcript
8. Translation happens on both devices
9. Translated text is displayed on both devices
10. Either user can use Text-to-Speech to hear the translation

## State Management
The application maintains several key states:
- Recording state (active/inactive)
- Current input/output languages
- Original transcript content
- Translated transcript content
- Processing states (loading indicators)
- Room connection status
- Connected users information
- Data synchronization status

State is managed client-side using React state management (useState, useContext) with Firebase providing real-time state synchronization between devices.

## Error Handling Strategy
- Graceful degradation for API failures
- Clear user feedback for connection issues
- Fallback options for unsupported browsers/devices
- Retry mechanisms for transient API failures
- Reconnection logic for dropped Firebase connections
- Device synchronization status indicators
- Logging for debugging and improvement

## Security Patterns
- Data minimization (no persistent storage of patient information)
- Transport security (HTTPS for all API communications)
- API key security (server-side proxying of sensitive API calls)
- Simple anonymous authentication for room access
- Room-based access control
- Content security policies to prevent XSS
- Input validation and sanitization 