-- Bookmarks table
CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  og_title TEXT,
  og_description TEXT,
  og_type TEXT,
  extracted_text TEXT,
  primary_tag TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tags table (many-to-many)
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL UNIQUE
);

-- Bookmark-Tag junction
CREATE TABLE bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  confidence REAL DEFAULT 1.0,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX idx_bookmarks_url ON bookmarks(url);
CREATE INDEX idx_bookmarks_primary_tag ON bookmarks(primary_tag);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_canonical_name ON tags(canonical_name);
