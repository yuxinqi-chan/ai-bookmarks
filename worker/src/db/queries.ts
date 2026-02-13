import type { BookmarkMetadata, Tag, BookmarkResponse } from '../types';

export async function saveBookmark(
  db: D1Database,
  metadata: BookmarkMetadata,
  tags: Tag[]
): Promise<BookmarkResponse> {
  if (tags.length === 0) {
    throw new Error('At least one tag is required to save a bookmark');
  }
  const primaryTag = tags[0]?.name;

  const existingBookmark = await db
    .prepare('SELECT id, url, title, primary_tag FROM bookmarks WHERE url = ?')
    .bind(metadata.url)
    .first<{ id: number; url: string; title: string; primary_tag: string }>();

  if (existingBookmark) {
    const existingTags = await getBookmarkTags(db, existingBookmark.id);
    return {
      id: existingBookmark.id,
      url: existingBookmark.url,
      title: existingBookmark.title,
      primary_tag: existingBookmark.primary_tag,
      tags: existingTags,
    };
  }

  const insertResult = await db
    .prepare(
      `INSERT INTO bookmarks (url, title, description, og_title, og_description, og_type, extracted_text, primary_tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      metadata.url,
      metadata.title || null,
      metadata.description || null,
      metadata.og_title || null,
      metadata.og_description || null,
      metadata.og_type || null,
      metadata.extracted_text || null,
      primaryTag
    )
    .run();

  const bookmarkId = insertResult.meta.last_row_id as number;

  for (const tag of tags) {
    await upsertTag(db, bookmarkId, tag);
  }

  return {
    id: bookmarkId,
    url: metadata.url,
    title: metadata.title || metadata.og_title || metadata.url,
    primary_tag: primaryTag,
    tags,
  };
}

async function upsertTag(db: D1Database, bookmarkId: number, tag: Tag): Promise<void> {
  let tagId: number;
  const canonicalName = tag.canonical_name || tag.name;

  const existingTag = await db
    .prepare('SELECT id FROM tags WHERE canonical_name = ?')
    .bind(canonicalName)
    .first<{ id: number }>();

  if (existingTag) {
    tagId = existingTag.id;
    // Update the display name to match current language
    await db
      .prepare('UPDATE tags SET name = ? WHERE id = ?')
      .bind(tag.name, tagId)
      .run();
  } else {
    const insertResult = await db
      .prepare('INSERT INTO tags (name, canonical_name) VALUES (?, ?)')
      .bind(tag.name, canonicalName)
      .run();
    tagId = insertResult.meta.last_row_id as number;
  }

  await db
    .prepare('INSERT OR REPLACE INTO bookmark_tags (bookmark_id, tag_id, confidence) VALUES (?, ?, ?)')
    .bind(bookmarkId, tagId, tag.confidence)
    .run();
}

async function getBookmarkTags(db: D1Database, bookmarkId: number): Promise<Tag[]> {
  const results = await db
    .prepare(
      `SELECT t.name, bt.confidence
       FROM tags t
       JOIN bookmark_tags bt ON t.id = bt.tag_id
       WHERE bt.bookmark_id = ?
       ORDER BY bt.confidence DESC`
    )
    .bind(bookmarkId)
    .all<{ name: string; confidence: number }>();

  return results.results || [];
}

export async function getAllBookmarks(db: D1Database): Promise<BookmarkResponse[]> {
  const bookmarks = await db
    .prepare(
      `SELECT id, url, title, primary_tag, created_at
       FROM bookmarks
       ORDER BY created_at DESC`
    )
    .all<{ id: number; url: string; title: string; primary_tag: string; created_at: string }>();

  if (!bookmarks.results || bookmarks.results.length === 0) {
    return [];
  }

  const bookmarksWithTags: BookmarkResponse[] = [];
  for (const bookmark of bookmarks.results) {
    const tags = await getBookmarkTags(db, bookmark.id);
    bookmarksWithTags.push({
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      primary_tag: bookmark.primary_tag,
      tags,
    });
  }

  return bookmarksWithTags;
}
