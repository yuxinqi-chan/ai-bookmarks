import { Hono } from 'hono';
import type { Env, BookmarkRequest } from '../types';
import { fetchPageMetadata } from '../services/fetcher';
import { generateTags } from '../services/tagger';
import { saveBookmark, getAllBookmarks } from '../db/queries';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  try {
    const bookmarks = await getAllBookmarks(c.env.DB);
    return c.json({
      bookmarks,
      total: bookmarks.length,
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return c.json(
      {
        error: 'Failed to fetch bookmarks',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

app.post('/', async (c) => {
  try {
    const body = await c.req.json<BookmarkRequest>();
    console.log('Received bookmark request:', body);
    if (!body.url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    const metadata = await fetchPageMetadata(body.url);

    if (body.title && !metadata.title) {
      metadata.title = body.title;
    }

    const tags = await generateTags(metadata, c.env.AI, body.language);
    console.log('Parsed tags:', tags);
    const result = await saveBookmark(c.env.DB, metadata, tags);
    console.log('Bookmark saved successfully:', result);
    return c.json(result);
  } catch (error) {
    console.error('Error processing bookmark:', error);
    return c.json(
      {
        error: 'Failed to process bookmark',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
