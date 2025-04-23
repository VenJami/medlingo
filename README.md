# MedLIngo: Healthcare Translation Web App

MedLIngo is a real-time healthcare translation web application that facilitates communication between patients and healthcare providers who speak different languages. The app leverages the power of AI to provide accurate medical translations and speech recognition.

## Features

- Real-time voice-to-text transcription
- AI-powered translation optimized for medical terminology
- Text-to-speech capability for translated content
- Multi-device communication with room-based sessions
- Mobile-responsive design

## Getting Started

### Prerequisites

- Node.js (latest LTS version)
- NPM or Yarn
- Firebase account

### Installation

1. Clone the repository
   ```
git clone https://github.com/yourusername/medlingo.git
cd medlingo
```

2. Install dependencies
   ```
npm install
```

3. Set up Firebase 
   - Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Enable Realtime Database and set up security rules
   - Enable Anonymous Authentication
   - Create a web app in your Firebase project
   - Copy the Firebase configuration

4. Create a `.env.local` file in the root directory with the following variables:
   ```
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

   # OpenAI API Key (if using real translations)
   OPENAI_API_KEY=your-openai-api-key
   ```

5. Run the development server
   ```
npm run dev
```

6. Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Firebase Security Rules

For proper functionality, configure your Firebase Realtime Database security rules as follows:

```json
{
  "rules": {
    "rooms": {
      "$room_id": {
        ".read": true,
        ".write": "auth != null",
        "participants": {
          "$user_id": {
            ".read": true,
            ".write": "auth != null && auth.uid === $user_id"
          }
        },
        "transcripts": {
          ".read": true,
          ".write": "auth != null"
        }
      }
    }
  }
}
```

## Usage

1. Open the app on two separate devices or browser windows
2. On the first device, click "Create Translation Room"
3. Note the room code that appears
4. On the second device, enter the room code and click "Join Room"
5. Begin speaking in your selected language
6. The speech will be transcribed, translated, and displayed on both devices
7. Use the "Speak" button to hear the translation

## Technologies Used

- Next.js
- React
- TypeScript
- Firebase (Realtime Database and Authentication)
- Web Speech API
- OpenAI API
- Tailwind CSS

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Healthcare professionals who provided input on medical translation needs
- The open-source community for the amazing tools that made this project possible
