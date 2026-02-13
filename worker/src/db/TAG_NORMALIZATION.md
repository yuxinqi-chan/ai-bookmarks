# Tag Normalization System

## Overview

This document describes the tag normalization system implemented to solve multi-language tag duplication issues.

## Problem Statement

Previously, the same tag concept in different languages (e.g., "技术" and "Technology") were treated as separate tags, causing:
1. Duplicate tag concepts in the database
2. Browser folders not adapting to user language changes
3. English tags with high confidence always being returned

## Solution

The tag normalization system uses a **canonical name** approach:
- `canonical_name`: English version of the tag (used for deduplication and matching)
- `name`: Display name in the user's current language

## Database Schema Changes

### Tags Table
```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL UNIQUE
);

CREATE INDEX idx_tags_canonical_name ON tags(canonical_name);
```

## Implementation Details

### 1. AI Tag Generation (`tagger.ts`)
The AI now generates both fields:
```json
{
  "name": "技术",
  "canonical_name": "Technology",
  "confidence": 0.9
}
```

### 2. Tag Deduplication (`queries.ts`)
- Tags are matched by `canonical_name` (not `name`)
- When a tag with the same `canonical_name` exists, the `name` is updated to the current language
- This ensures the same tag concept is reused across languages

### 3. Language-Aware Display
- The `name` field is updated each time a bookmark is saved with a different language
- Users see folder names in their current browser language

## Migration

For existing databases, run the migration script:
```bash
wrangler d1 execute ai-bookmarks-db --file=src/db/migration_add_canonical_name.sql
```

This will:
1. Add the `canonical_name` field to the tags table
2. Use existing `name` values as `canonical_name` for backward compatibility
3. Recreate necessary indexes

## Backward Compatibility

- Existing tags will have their `name` copied to `canonical_name`
- The system gracefully handles tags without `canonical_name` by using `name` as fallback
- No data loss occurs during migration

## Example Flow

1. User (Chinese browser) saves a tech article
   - AI generates: `{name: "技术", canonical_name: "Technology"}`
   - Database stores both values

2. Same user switches to English browser, saves another tech article
   - AI generates: `{name: "Technology", canonical_name: "Technology"}`
   - System finds existing tag with `canonical_name: "Technology"`
   - Updates `name` to "Technology"
   - Reuses the same tag ID

3. Result: Both bookmarks share the same tag, displayed in the user's current language

## Benefits

1. **No Duplication**: Same concept = same tag, regardless of language
2. **Dynamic Display**: Folder names adapt to user's current language
3. **Consistent Categorization**: Related bookmarks stay together
4. **Backward Compatible**: Existing data continues to work
