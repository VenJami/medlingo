# MedLIngo: Healthcare Translation Web App

MedLIngo is a real-time healthcare translation web application that facilitates communication between patients and healthcare providers who speak different languages. The app leverages the power of AI to provide accurate medical translations and speech recognition.

## Features

- Real-time voice-to-text transcription
- AI-powered translation optimized for medical terminology
- Text-to-speech capability for translated content
- Multi-device communication with room-based sessions
- Mobile-responsive design
- **Browser compatibility check (recommends Chrome for speech features)**

## Browser Compatibility

**Important:** This application utilizes the Web Speech API for real-time voice transcription. Currently, browser support for this API varies. 

- **Google Chrome (or Chromium-based browsers like Brave, new Edge versions)** provide the most reliable experience for speech recognition features.
- Other browsers (like Firefox, Safari, older Edge) may have limited or no support. 
- The application will display a notification modal on the home screen if your browser is detected as unsupported, recommending you switch to Chrome.

## Getting Started

### Prerequisites

- Node.js (latest LTS version)
- NPM or Yarn
- Firebase account
- **Google Chrome (Recommended for full functionality)**

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

   # GitHub Marketplace Model Credentials (if required)
   GITHUB_MARKETPLACE_API_CREDENTIALS=your-credentials # Check GitHub Marketplace model documentation for required credentials
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

1. **Open the app in Google Chrome (recommended).** If using an unsupported browser, you will see a notification.
2. Open the app on two separate devices or browser windows.
3. On the first device, click "Create Translation Room" (enter name/role).
4. Note the room code that appears.
5. On the second device, enter the room code and your name, then click "Join Room".
6. Begin speaking in your selected language.
7. The speech will be transcribed, translated, and displayed on both devices.
8. Use the "Speak" button to hear the translation.

## Technologies Used

- Next.js
- React
- TypeScript
- Firebase (Realtime Database and Authentication)
- Web Speech API
- Meta-Llama-3.1-70B-Instruct (via GitHub Marketplace)
- Tailwind CSS

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Healthcare professionals who provided input on medical translation needs
- The open-source community for the amazing tools that made this project possible
