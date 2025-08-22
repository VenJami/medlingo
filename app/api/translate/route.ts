import { NextResponse } from 'next/server';
import { translateText } from '../../../utils/translation'; // Adjust path as needed

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, sourceLanguage, targetLanguage } = body;

    if (!text || !sourceLanguage || !targetLanguage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure required server-side credential is present (OpenRouter)
    if (!process.env.OPENROUTER_API_KEY) {
       console.error('OPENROUTER_API_KEY is not configured on the server.');
       return NextResponse.json({ error: 'Server configuration error: translation service not configured' }, { status: 500 });
    }

    const translatedResult = await translateText(text, sourceLanguage, targetLanguage);

    return NextResponse.json({ translation: translatedResult });

  } catch (error: any) {
    console.error('[API Translate Error]', error);
    // Rate limit or quota errors
    const isRateLimitError = error.message?.includes('429') || error.message?.toLowerCase?.().includes('rate') || error.status === 429;
    if (isRateLimitError) {
      return NextResponse.json({ error: 'The AI translation service is temporarily rate-limited. Please wait a moment and try again.' }, { status: 429 });
    }

    // Generic error
    return NextResponse.json({ error: 'Failed to translate text', details: error.message || 'Unknown error' }, { status: 500 });
  }
} 