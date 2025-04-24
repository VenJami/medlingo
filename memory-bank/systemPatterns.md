# System Patterns: Healthcare Translation Web App with Generative AI

## Architecture Overview
Healthcare Translation Web App with Generative AI follows a client-side web application architecture with API integrations and real-time multi-device communication. The frontend handles user interactions, speech recognition, and display, while the Llama 3.1 70B model accessed via the GitHub Marketplace Models API manages translation. Firebase Realtime Database provides the infrastructure for room-based real-time communication between patients and healthcare providers, limited to two participants with assigned roles (Doctor/Patient). This architecture enables rapid development while maintaining performance for real-time interactions across devices.

## Design Patterns
- **Observer Pattern**: For real-time updates between speech recognition and translation
- **Facade Pattern**: To simplify interactions with complex APIs (speech recognition, translation)
- **Strategy Pattern**: For switching between different language translation approaches
- **Pub/Sub Pattern**: For real-time communication between devices via Firebase
- **Singleton Pattern**: For managing room connections and session state
- **Modal Pattern**: For user input during room creation (name, role, agreement).

## Component Relationships
The application consists of several key components:
1. **Speech Recognition Module**: Captures voice input and converts to text
2. **Translation Service**: Processes text and returns translations using Llama 3.1 70B via GitHub Marketplace.
3. **Text-to-Speech Module**: Converts translated text to audio
4. **UI Interface**: Handles user interactions and displays transcripts
5. **Language Management**: Controls language selection and configuration
6. **Room Management**: Handles creating (with role selection via modal), joining (assigning remaining role), and leaving translation sessions.
7. **Real-time Communication**: Manages data synchronization between devices via Firebase, including participant roles and status.
8. **Create Room Modal**: A new component for collecting user name, role, and agreement before room creation.

These components interact through events and callbacks to maintain real-time functionality.

## Data Flow
### Single-Device Flow
1. User speaks into device microphone
2. Speech Recognition API converts speech to text
3. Text is displayed in original language transcript
4. Text is sent to the Llama Translation API (GitHub Marketplace)
5. Translated text is returned and displayed
6. When requested, Text-to-Speech converts translation to audio

### Multi-Device Flow (with Roles & Dynamic Display)
1. User A (e.g., Doctor) initiates room creation, selects role and enters name via modal.
2. Room is created in Firebase with User A's participant details.
3. User B (e.g., Patient) joins room, enters name, gets assigned remaining role.
4. User B's participant details added to Firebase.
5. Both users' clients listen for transcript updates and participant data.
6. User A speaks (e.g., English).
7. Speech recognition -> `originalText` (English).
8. Translation -> `translatedText` (Spanish).
9. Client constructs `ConversationTurn` object (speaker A info, English text, Spanish text, timestamp, etc.).
10. `ConversationTurn` object is added to local state (`conversationTurns` array) and saved to Firebase transcripts.
11. **User A's UI Update:**
    - Left Panel (Viewer's Language): Displays User A's `originalText` (English) with speaker label.
    - Right Panel (Other Language): Displays User A's `translatedText` (Spanish) with speaker label.
12. **User B's UI Update (on receiving transcript via listener):**
    - Constructs `ConversationTurn` object from Firebase data.
    - Left Panel (Viewer's Language): Displays User A's `translatedText` (Spanish) with speaker label.
    - Right Panel (Other Language): Displays User A's `originalText` (English) with speaker label.
13. Process repeats for User B speaking (e.g., Spanish), translating to English.
14. If a user leaves, their `isActive` flag is set to `false` in Firebase. Only they can rejoin.

## State Management
The application maintains several key states:
- Recording state (active/inactive)
- Current input/output languages
- Processing states (loading indicators)
- Room connection status (`roomData` including participants: name, role, isActive)
- Current user's assigned role (`myData` derived from `roomData`)
- **`conversationTurns`: An array of objects, each representing a spoken turn with speaker info, original text, translated text, timestamp, etc.**
- Data synchronization status

State is managed client-side using React state management (useState, useContext, useMemo) with Firebase providing real-time state synchronization for room data and transcripts.

## Error Handling Strategy
- Graceful degradation for API failures (Llama, Firebase, Speech)
- Clear user feedback for connection issues (including "Room Full" errors)
- **Fallback options for unsupported browsers/devices (Modal on Home screen recommending Chrome)**
- Retry mechanisms for transient API failures
- Reconnection logic for dropped Firebase connections
- Device synchronization status indicators
- Logging for debugging and improvement

## Security Patterns
- Data minimization (no persistent storage of patient information)
- Transport security (HTTPS for all API communications)
- API key security (server-side proxying recommended for GitHub Marketplace API)
- Simple anonymous authentication for room access
- Room-based access control (including limit of 2 participants with specific roles)
- Content security policies to prevent XSS
- Input validation and sanitization

## Firebase Realtime Database Structure
### Rooms
```json
{
  "rooms": {
    "<ROOM_CODE>": {
      "createdAt": <timestamp>,
      "createdBy": "<userId>",
      "participants": {
        "<userId1>": {
          "name": "<displayName>",
          "role": "doctor" | "patient",
          "isActive": true | false,
          "joinedAt": <timestamp>
        },
        "<userId2>": {
          "name": "<displayName>",
          "role": "doctor" | "patient",
          "isActive": true | false,
          "joinedAt": <timestamp>
        }
        // Only max 2 participants total
      }
    }
  }
}
```

### Transcripts (Example - May need refinement)
```json
{
  "rooms": {
    "<ROOM_CODE>": {
      // ... other room data ...
      "transcripts": {
        "<timestamp_or_push_id>": {
          "uid": "<speaker_userId>", 
          // Optional: Store speaker name/role here if not deriving from participants
          // "speakerName": "<displayName>", 
          // "speakerRole": "doctor" | "patient",
          "timestamp": <server_timestamp>,
          "originalLang": "en-US",
          "originalText": "Hello doctor.",
          "translatedLang": "es-ES",
          "translatedText": "Hola doctor."
        },
        // ... more transcript entries ...
      }
    }
  }
}
``` 