import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

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

// Initialize Azure AI Inference Client
// Ensure GITHUB_TOKEN is set in your .env.local file
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN environment variable is not set.");
  // Optionally throw an error or provide a default behavior
}
const client = token
  ? ModelClient(
      "https://models.inference.ai.azure.com",
      new AzureKeyCredential(token)
    )
  : null; // Handle the case where the token might be missing

export const translateText = async (
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> => {
  if (!text.trim()) return '';
  if (!client) {
    console.error("Azure AI Inference client is not initialized due to missing GITHUB_TOKEN.");
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


    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "Meta-Llama-3.1-70B-Instruct", // Use the Llama model
        temperature: 0.3, // Keep low for consistency
        max_tokens: 4000, // Use the model's max output token limit
        // top_p: 0.1 // Generally not recommended to use both temp and top_p
      },
      // Set content type explicitly if needed, though SDK usually handles it
      // headers: { 'Content-Type': 'application/json' }
    });

    if (isUnexpected(response)) {
        // Log the detailed error from the Azure AI service
        console.error('Azure AI Inference API Error:', response.body?.error || response.status);
        // Provide more specific error details if available
        const errorMessage = response.body?.error?.message || `Translation failed with status code ${response.status}. Check server logs.`;
        throw new Error(errorMessage);
    }

    const translation = response.body.choices?.[0]?.message?.content?.trim() || text;

    // Cache the result for future use
    translationCache[cacheKey] = translation;

    return translation;
  } catch (error: any) {
      // Catch errors from the SDK call itself or the isUnexpected check
      console.error('Translation function error:', error);
      // Re-throw a user-friendly error message
      throw new Error(error.message || 'Translation failed. Please check server logs.');
  }
}; 