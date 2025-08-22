// Using OpenRouter as the translation backend (OpenAI-compatible API)

// Get language name from language code
const getLanguageName = (code: string): string => {
  const languageMap: { [key: string]: string } = {
    'en-US': 'English',
    'es-ES': 'Spanish',
    'fr-FR': 'French',
    'de-DE': 'German',
    'zh-CN': 'Chinese',
    'ja-JP': 'Japanese',
    'ar-SA': 'Arabic',
    'ru-RU': 'Russian',
    'pt-BR': 'Portuguese',
    'hi-IN': 'Hindi',
  };
  return languageMap[code] || code;
};

// Simple in-memory cache for translations to reduce API calls
const translationCache: Record<string, string> = {};

// Ensure OPENROUTER_API_KEY is set in your .env.local file (server-side only)
const token = process.env.OPENROUTER_API_KEY;
const openrouterModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
if (!token) {
  console.error("OPENROUTER_API_KEY environment variable is not set.");
}

export const translateText = async (
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> => {
  if (!text.trim()) return '';
  if (!token) {
    console.error("Translation token (GITHUB_TOKEN) is missing.");
    throw new Error('Translation service is not configured.');
  }

  // Create a cache key based on text and languages
  const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;

  // Check if we already have this translation cached
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  try {
    // Extract language names from codes
    const sourceLang = getLanguageName(sourceLanguage);
    const targetLang = getLanguageName(targetLanguage);

    // Build prompt for translation with medical context
    // Adjusted slightly for Llama model's typical instruction format
    const systemPrompt = `You are a specialized medical translator expert in healthcare terminology. Translate accurately from ${sourceLang} to ${targetLang}, focusing on medical conditions, anatomy, medications, procedures, and diagnostics. Provide only the translation.`;
    const userPrompt = `Translate the following medical text from ${sourceLang} to ${targetLang}:\n\n\"${text}\"\n\nTranslation:`;


    const headers: Record<string, string> = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        // OpenRouter model (configurable via env)
        model: openrouterModel,
        temperature: 0.3,
        max_tokens: 4000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as any));
      console.error('OpenRouter API Error:', err || response.status);
      const errorMessage =
        err?.error?.metadata?.raw ||
        err?.error?.message ||
        err?.message ||
        (typeof err === 'string' ? err : JSON.stringify(err)) ||
        `Translation failed with status code ${response.status}.`;
      const e: any = new Error(errorMessage);
      e.status = response.status;
      throw e;
    }

    const data = await response.json();
    const translation = data?.choices?.[0]?.message?.content?.trim() || text;

    // Cache the result for future use
    translationCache[cacheKey] = translation;

    return translation;
  } catch (error: any) {
    console.error('Translation function error:', error);
    throw new Error(error.message || 'Translation failed. Please check server logs.');
  }
}; 