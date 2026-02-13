import type { BookmarkMetadata, Tag } from '../types';

export async function generateTags(
  metadata: BookmarkMetadata,
  ai: any,
  language?: string
): Promise<Tag[]> {
  const prompt = buildPrompt(metadata, language);
  console.log('Generated prompt for tag generation:', prompt);
  try {
    const response = await ai.run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that categorizes web content. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
    console.log('AI response for tag generation:', JSON.stringify(response.choices[0].message.content));
    const tags = parseTagsFromResponse(response.choices[0].message.content);
    return tags;
  } catch (error) {
    console.error('Failed to generate tags:', error);
    return [];
  }
}

function buildPrompt(metadata: BookmarkMetadata, language?: string): string {
  const parts = [`URL: ${metadata.url}`];

  if (metadata.title || metadata.og_title) {
    parts.push(`Title: ${metadata.title || metadata.og_title}`);
  }

  if (metadata.description || metadata.og_description) {
    parts.push(`Description: ${metadata.description || metadata.og_description}`);
  }

  if (metadata.extracted_text) {
    parts.push(`Content: ${metadata.extracted_text}`);
  }

  const context = parts.join('\n');

  // Build language instruction
  let languageInstruction = '';
  let languageName = 'English';

  if (language) {
    const languageMap: Record<string, string> = {
      'zh': 'Chinese',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'ja': 'Japanese',
      'ja-JP': 'Japanese',
      'ko': 'Korean',
      'ko-KR': 'Korean',
      'fr': 'French',
      'fr-FR': 'French',
      'de': 'German',
      'de-DE': 'German',
      'es': 'Spanish',
      'es-ES': 'Spanish',
      'it': 'Italian',
      'it-IT': 'Italian',
      'pt': 'Portuguese',
      'pt-BR': 'Portuguese (Brazilian)',
      'ru': 'Russian',
      'ru-RU': 'Russian',
      'ar': 'Arabic',
      'ar-SA': 'Arabic',
    };

    const langCode = language.split('-')[0];
    languageName = languageMap[language] || languageMap[langCode] || 'English';
    languageInstruction = `\n\nIMPORTANT: Generate all tag names in ${languageName} (${language}).`;
  }

  return `Given this webpage metadata, suggest 2-5 category tags. Return JSON array of objects with "name", "canonical_name", and "confidence" fields.

- "name": The tag name in the user's language (${languageName})
- "canonical_name": The English version of the tag (used for deduplication across languages)
- "confidence": A number between 0 and 1

Tags should be freeform and descriptive of the content (no predefined taxonomy).${languageInstruction}

${context}

Example format:
[
  {"name": "技术", "canonical_name": "Technology", "confidence": 0.9},
  {"name": "编程", "canonical_name": "Programming", "confidence": 0.85}
]

Return only the JSON array, no other text.`;
}

function parseTagsFromResponse(content: any): Tag[] {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      console.error('Parsed tags is not an array:', parsed);
      return [];
    }

    return parsed
      .filter((item: any) => item.name && typeof item.confidence === 'number')
      .map((item: any) => ({
        name: item.name.trim(),
        canonical_name: item.canonical_name?.trim() || item.name.trim(),
        confidence: Math.max(0, Math.min(1, item.confidence)),
      }))
      .slice(0, 5);
  } catch (error) {
    console.error('Failed to parse tags from response:', error);
    return [];
  }
}
