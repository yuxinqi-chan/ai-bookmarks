import type { BookmarkMetadata } from '../types';

export async function fetchPageMetadata(url: string): Promise<BookmarkMetadata> {
  const metadata: BookmarkMetadata = { url };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Bookmarks/1.0)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return metadata;
    }

    const html = await response.text();

    metadata.title = extractTag(html, '<title>', '</title>');
    metadata.description = extractMetaContent(html, 'description');
    metadata.og_title = extractMetaContent(html, 'og:title');
    metadata.og_description = extractMetaContent(html, 'og:description');
    metadata.og_type = extractMetaContent(html, 'og:type');

    const bodyText = extractBodyText(html);
    metadata.extracted_text = bodyText.slice(0, 500);

  } catch (error) {
    console.error('Failed to fetch page metadata:', error);
  }

  return metadata;
}

function extractTag(html: string, startTag: string, endTag: string): string | undefined {
  const startIndex = html.indexOf(startTag);
  if (startIndex === -1) return undefined;

  const contentStart = startIndex + startTag.length;
  const endIndex = html.indexOf(endTag, contentStart);
  if (endIndex === -1) return undefined;

  return html.slice(contentStart, endIndex).trim();
}

function extractMetaContent(html: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${name}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

function extractBodyText(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}
