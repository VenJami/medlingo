# Technical Context: Healthcare Translation Web App with Generative AI

## Technology Stack
- **Frontend**: React.js with Next.js framework for fast, responsive UI
- **Client Components**: React components with 'use client' directive
- **Server Components**: Next.js App Router server components
- **Speech Recognition**: Web Speech API (browser-native)
- **Translation**: Meta-Llama-3.1-70B-Instruct (via GitHub Marketplace Models API)
- **Text-to-Speech**: Web Speech API SpeechSynthesis
- **Real-time Communication**: Firebase Realtime Database
- **Authentication**: Firebase Anonymous Auth
- **Styling**: Tailwind CSS for responsive design
- **Deployment Target**: Vercel (planned)

## Development Environment
- Node.js (latest LTS version)
- npm package manager
- Git for version control
- Next.js 15.3.1 with Turbopack
- TypeScript for type safety
- Chrome browser for development and testing
- IDE: Cursor
- Firebase CLI for local development and deployment
- GitHub: For remote repository hosting (https://github.com/VenJami/medlingo.git)

## Build & Deployment Process
1. Development on local environment (http://localhost:3001)
2. Manual testing against multiple browsers and devices
3. Build process through Next.js build system
4. Firebase configuration for production environment
5. Planned deployment to Vercel

## Dependencies
- **React/Next.js**: Core application framework
- **[Library Name] for GitHub Marketplace Models API interaction** (if applicable)
- **Firebase**: For real-time database and authentication
- **TailwindCSS**: For styling
- **TypeScript**: For type safety
- **Web Speech API**: Browser native capabilities for speech

## API Integrations
- **Llama Translation API (GitHub Marketplace)**: For high-quality translations with medical context
  - Using Meta-Llama-3.1-70B-Instruct model via GitHub Marketplace (https://github.com/marketplace/models/azureml-meta/Meta-Llama-3-1-70B-Instruct)
  - Requires specific prompts/handling for medical terminology (TBD)
- **Web Speech API**: 
  - SpeechRecognition for voice-to-text
  - SpeechSynthesis for text-to-speech
- **Firebase Realtime Database**:
  - Room-based real-time communication
  - State synchronization between devices
  - Anonymous authentication for room access

## Technical Constraints
- Browser compatibility (Speech API works best in Chrome)
- API key security in client-side applications (Consider backend proxy for GitHub Marketplace API if sensitive)
- Potential rate limits and costs associated with GitHub Marketplace Models API.
- Latency considerations for large Llama 3.1 70B model.
- Mobile device microphone access permissions
- Real-time performance requirements
- Hydration errors from browser extensions (now suppressed)
- Firebase free tier limitations
- Multi-device testing complexity

## Technical Solutions Implemented
- Client/Server component architecture for Next.js App Router
- Error suppression for browser extension conflicts
- In-memory caching for repeated translations
- Tailored system prompts for medical terminology
- Browser detection to improve speech recognition
- Mobile-responsive design with Tailwind CSS
- Fallback mechanisms for API failures
- Planning room-based communication architecture
- Designing multi-device data synchronization

## Testing Strategy
- Manual testing for UI functionality
- Cross-browser testing for compatibility
- Mobile device testing for responsive design
- Translation accuracy testing with medical terms
- System stability testing during continuous use
- Multi-device communication testing
- Connection resilience testing 