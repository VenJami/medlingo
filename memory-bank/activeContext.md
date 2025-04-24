# Active Context: Healthcare Translation Web App with Generative AI

## Current Focus
Implementing a browser compatibility check on the main Home screen (`components/Home.tsx`). This involves detecting if the browser supports the required Web Speech API or is explicitly unsupported (like Edge) and displaying a modal to the user, preventing them from creating/joining a room if unsupported.

## Recent Changes
- Set up Next.js framework with React and Tailwind CSS
- Created core components (TranslationApp, LanguageSelector, TranscriptPanel, ControlPanel)
- Implemented Web Speech API for speech recognition
- Added text-to-speech capability 
- Fixed hydration errors with client/server component separation
- Implemented error suppression for browser extension conflicts
- Developed implementation plan for two-device communication system
- Switched translation backend from OpenAI to Meta-Llama-3.1-70B-Instruct via GitHub Marketplace Models (https://github.com/marketplace/models/azureml-meta/Meta-Llama-3-1-70B-Instruct).
- Set up Git version control and pushed initial commit to GitHub repository (https://github.com/VenJami/medlingo.git)
- Fixed recording start/stop functionality by correcting useEffect dependencies in TranslationApp
- Implemented Doctor/Patient role system:
  - Added room creation modal for name/role selection.
  - Updated Firebase functions (`createRoom`, `joinRoom`, `leaveRoom`) for two-participant (Doctor/Patient) logic.
  - Integrated role/name display and leave functionality into `TranslationApp`.
  - Restricted room access to only the first two participants.
- **Implemented browser compatibility check on Home screen (`components/Home.tsx`)**: 
  - Added state and `useEffect` to check `getSpeechRecognition` result on mount.
  - Added a modal displayed to users on unsupported browsers (e.g., Edge) with instructions to use Chrome and a 'Copy URL' button.
  - Disabled Create/Join room buttons and inputs if the browser is unsupported.

## Next Steps
1.  **Clean up `TranslationApp.tsx`**: Remove the redundant browser compatibility check logic (state, effect, modal) that was previously added there.
2.  **Test Browser Check**: Verify the modal appears correctly on unsupported browsers (like Edge) and prevents room entry, while Chrome users can proceed normally.
3.  **Resume Dynamic Transcript Enhancement Plan** (Phases 1-4 outlined below).

### Dynamic Transcript Enhancement Plan
#### Phase 1: Data Structure for Conversation Turns
- Define/refine state structure (`ConversationTurn[]`) to hold speaker details, original/translated text, language, etc.
- Ensure Firebase transcript listener provides necessary data (UID, text, lang) to populate this structure.

#### Phase 2: Dynamic Rendering in Dual Panels
- Update `TranslationApp` render logic to iterate through `conversationTurns`.
- Panel 1 (Left): Display viewer's original text or other's translated text.
- Panel 2 (Right): Display viewer's translated text or other's original text.
- Add speaker labels (You/Doctor/Patient + Name) to each turn in both panels.
- Implement auto-scrolling.
- (Optional) Add visual cues like highlighting or background differences.

#### Phase 3: State Management and Synchronization
- Update `handleTranslation` to construct and save the full `ConversationTurn` object locally and to Firebase.
- Update `listenToTranscripts` callback to correctly process incoming data into the `conversationTurns` state.

#### Phase 4: Testing
- Test back-and-forth conversations with different languages.
- Verify panel contents, speaker labels, real-time updates, and scrolling.

### Deployment & Documentation (Following Enhancement)
- Deploy to Vercel
- Create simple documentation for demonstration
- Prepare test cases for showcasing functionality
- Final quality assurance

## Active Decisions
- Using Meta-Llama-3.1-70B-Instruct via GitHub Marketplace Models for translation.
- Using client/server component separation pattern for Next.js
- Adding Firebase Realtime Database for multi-device communication
- Maintaining a clear separation between browser and server code
- Implementing proper error handling for browser extensions
- Creating room-based communication system for patient-provider connections
- Focus on real-time communication rather than conversation history
- Use Firebase structure `participants/{userId}: { name, role, isActive, joinedAt }` for storing roles.
- Limit rooms to 2 active participants (1 Doctor, 1 Patient).
- Allow only original participants to rejoin a room after leaving (by setting `isActive` flag).
- Require user agreement acceptance via modal checkbox before room creation.
- Adopt a turn-based data structure (`ConversationTurn[]`) for displaying transcripts.
- Render dual panels dynamically based on conversation turns and viewer context.
- Prioritize displaying text in the viewer's language in the left panel.
- Include clear speaker attribution (Role + Name) for each turn.
- **Perform browser capability checks early (on Home screen) to inform users before they attempt to use speech-dependent features.**

## Known Issues
- Requires appropriate configuration/authentication for GitHub Marketplace Models API.
- Potential latency considerations with the 70B Llama model.
- Potential API rate limits or costs associated with GitHub Marketplace usage.
- Web Speech API compatibility varies across browsers (**actively handled by check on Home screen, recommending Chrome**).
- Browser extensions can cause hydration errors (now suppressed)
- Multi-device synchronization adds complexity to the application
- Firebase has usage limits on the free tier

## Questions to Resolve
- How to ensure reliable real-time communication between devices?
- What is the best approach for handling connection drops during translation?
- How to optimize the room joining experience for non-technical users?
- How to manage the state synchronization between devices efficiently?
- How well does the translation function handle specific medical terminology?
- What specific medical scenarios should be optimized for the demo?

## Resources & References
- [GitHub Marketplace Model: Meta-Llama-3.1-70B-Instruct](https://github.com/marketplace/models/azureml-meta/Meta-Llama-3-1-70B-Instruct)
- [Web Speech API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Firebase Realtime Database Documentation](https://firebase.google.com/docs/database) 