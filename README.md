# MedLIngo – Healthcare Translation Web App

Real-time speech-to-text and AI translation prototype for doctor–patient conversations.

## Live Demo

[medlingo-mu.vercel.app](https://medlingo-mu.vercel.app/)

## Features

- Real-time voice-to-text transcription (Web Speech API)
- AI translation optimized for medical terminology (OpenRouter)
- Text-to-speech for translated content
- Dual-panel conversation turns (original vs translated)
- Room-based sessions (Doctor/Patient) via Firebase
- Mobile-responsive design and Chrome compatibility checks

## Browser Compatibility

This app uses the Web Speech API. Support varies by browser:

- Chrome (desktop/mobile) is recommended for speech recognition.
- Other browsers may have limited or no support; the Home screen warns if unsupported.

## Getting Started

### Prerequisites

- Node.js 22 LTS (recommended) and npm 10+
- Google Chrome (best Web Speech API support)
- Firebase project (Realtime Database + Anonymous Auth)
- OpenRouter account and API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/VenJami/medlingo.git
cd medlingo
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env.local` file in the project root with:
```bash
# Firebase (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# OpenRouter (server-side)
OPENROUTER_API_KEY=sk-or-...
# Optional: choose a model (defaults to free model)
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

4. Run the development server
```bash
npm run dev
# visit http://localhost:3000 (or the printed port)
```

## Firebase Security Rules (starter)

Use a conservative ruleset while prototyping. Adjust to your needs:
```json
{
  "rules": {
    "+rules_version": "2",
    "rooms": {
      "$room": {
        ".read": true,
        ".write": "auth != null",
        "participants": {
          "$uid": {
            ".read": true,
            ".write": "auth != null && auth.uid == $uid"
          }
        },
        "transcripts": {
          ".read": true,
          ".write": "auth != null"
        },
        "realtimeSpeech": {
          "$uid": {
            ".read": true,
            ".write": "auth != null && auth.uid == $uid"
          }
        }
      }
    }
  }
}
```

## Usage

1. Open Chrome → allow microphone access.
2. Create a room (choose name and role) and share the 6‑char code.
3. Second participant joins with the code; roles are enforced (Doctor/Patient).
4. Select Source and Target languages → Start Recording → speak → Stop to translate.
5. Both panels update with turn‑by‑turn conversation (original vs translated).

Example you can try:

- Doctor phrasing: “You have community‑acquired pneumonia; we’ll start empirical antibiotics covering typical pathogens.”
- Patient‑friendly: “You have a lung infection you caught outside the hospital. We’ll start antibiotics that treat the usual germs.”

## Technologies Used

- Next.js, React, TypeScript
- Firebase Realtime Database, Anonymous Auth
- Web Speech API (SpeechRecognition, SpeechSynthesis)
- OpenRouter models (e.g., meta-llama/llama-3.3-70b-instruct:free)
- Tailwind CSS

## Disclaimer

This is a personal prototype for demonstration/education. It is not a medical device and should not be used for diagnosis or treatment. Free models may be rate‑limited; if you see a rate‑limit notice, wait 1–2 minutes and try again.

## Author & Links

- GitHub: https://github.com/VenJami
- LinkedIn: https://www.linkedin.com/in/ravenjaminal/

## License

MIT. See `LICENSE` for details.
