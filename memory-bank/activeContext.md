# Active Context: Healthcare Translation Web App with Generative AI

## Current Focus
Pivoting to implement a multi-device real-time translation system with room-based communication. The application will now enable direct communication between patients and healthcare providers using separate devices, while maintaining the core translation functionality. This enhancement aligns with the goal of facilitating real-time communication across language barriers in healthcare settings.

## Recent Changes
- Set up Next.js framework with React and Tailwind CSS
- Created core components (TranslationApp, LanguageSelector, TranscriptPanel, ControlPanel)
- Implemented Web Speech API for speech recognition
- Configured OpenAI API integration with lightweight model (gpt-3.5-turbo)
- Added text-to-speech capability 
- Fixed hydration errors with client/server component separation
- Added in-memory caching for translations to reduce API costs
- Enhanced prompts for medical terminology accuracy
- Added API key warning message for better user experience
- Implemented error suppression for browser extension conflicts
- Developed implementation plan for two-device communication system

## Next Steps
### Phase 1: Setup & Core Components (8 hours)
- Set up Next.js project with TypeScript and TailwindCSS
- Configure Firebase project and Realtime Database
- Create basic UI components:
  - Home/landing page with room creation
  - Translation interface with dual panels
  - Language selector component
  - Control panel (record, stop, speak buttons)

### Phase 2: Single-Device Functionality (12 hours)
- Implement Web Speech API for speech recognition
- Set up OpenAI API integration for translation
- Add text-to-speech playback functionality
- Build language selection interface
- Create responsive UI for mobile and desktop

### Phase 3: Multi-Device Communication (12 hours)
- Implement Firebase authentication (simple anonymous auth)
- Create room generation and joining functionality
- Set up real-time data synchronization between devices
- Implement status indicators (connected users, recording status)
- Add error handling for connection issues

### Phase 4: Testing & Refinement (8 hours)
- Test on multiple devices and browsers
- Optimize for different network conditions
- Improve error handling and user feedback
- Fix bugs and performance issues

### Phase 5: Deployment & Documentation (8 hours)
- Deploy to Vercel
- Create simple documentation for demonstration
- Prepare test cases for showcasing functionality
- Final quality assurance

## Active Decisions
- Using OpenAI gpt-3.5-turbo model for cost-effective translations
- Implementing client-side caching to minimize API costs
- Using client/server component separation pattern for Next.js
- Adding Firebase Realtime Database for multi-device communication
- Maintaining a clear separation between browser and server code
- Implementing proper error handling for browser extensions
- Creating room-based communication system for patient-provider connections
- Focus on real-time communication rather than conversation history

## Known Issues
- OpenAI API requires a valid API key to be set in .env.local
- Web Speech API compatibility varies across browsers (works best in Chrome)
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
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Web Speech API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Firebase Realtime Database Documentation](https://firebase.google.com/docs/database) 