export interface Tag {
  name: string;
  confidence: number;
}

export interface BookmarkResponse {
  id: number;
  url: string;
  title: string;
  primary_tag: string;
  tags: Tag[];
}

export interface LastBookmark {
  title: string;
  url: string;
  tags: Tag[];
  timestamp: number;
}

export interface LocalBookmarkData {
  tags: {
    [tagName: string]: Array<{
      id: number;
      url: string;
      title: string;
    }>;
  };
  lastSync: number;
}
