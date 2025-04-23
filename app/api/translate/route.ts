import { NextResponse } from 'next/server';
import { translateText } from '../../../utils/translation'; // Adjust path as needed

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, sourceLanguage, targetLanguage } = body;

    if (!text || !sourceLanguage || !targetLanguage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure environment variable is read server-side
    if (!process.env.OPENAI_API_KEY) {
       console.error('OpenAI API key is not configured on the server.');
       return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const translatedResult = await translateText(text, sourceLanguage, targetLanguage);

    return NextResponse.json({ translation: translatedResult });

  } catch (error: any) {
    console.error('[API Translate Error]', error);
    // Check if it's an OpenAI specific error (like rate limit) passed through
     const isRateLimitError = error.message?.includes('429') || error.status === 429;
     if (isRateLimitError) {
       return NextResponse.json({ error: 'OpenAI rate limit hit. Please wait and try again.' }, { status: 429 });
     }
    
    // Generic error
    return NextResponse.json({ error: 'Failed to translate text', details: error.message || 'Unknown error' }, { status: 500 });
  }
} 