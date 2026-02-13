export interface Env {
  DB: D1Database;
  AI: any;
  API_KEY?: string;
}

export interface BookmarkMetadata {
  url: string;
  title?: string;
  description?: string;
  og_title?: string;
  og_description?: string;
  og_type?: string;
  extracted_text?: string;
}

export interface Tag {
  name: string;
  canonical_name?: string;
  confidence: number;
}

export interface BookmarkResponse {
  id: number;
  url: string;
  title: string;
  primary_tag: string;
  tags: Tag[];
}

export interface BookmarkRequest {
  url: string;
  title?: string;
  language?: string;
}
