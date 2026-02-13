import type { BookmarkResponse, LastBookmark, LocalBookmarkData } from './types';

const folderCache = new Map<string, string>();
let otherBookmarksFolderId: string | null = null;

chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (!bookmark.url) return;

  if (isInternalUrl(bookmark.url)) {
    console.log('Skipping internal URL:', bookmark.url);
    return;
  }

  // 只处理根目录的书签
  const isInRootFolder = await isBookmarkInRootFolder(bookmark.parentId);
  if (!isInRootFolder) {
    console.log('Skipping bookmark not in root folder:', bookmark.url);
    return;
  }

  await processBookmark(id, bookmark.url, bookmark.title);
});

chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
  // 检查是否移动到根目录
  const isMovedToRoot = await isBookmarkInRootFolder(moveInfo.parentId);
  if (!isMovedToRoot) {
    return;
  }

  // 获取书签信息
  const [bookmark] = await chrome.bookmarks.get(id);
  if (!bookmark.url) return;

  if (isInternalUrl(bookmark.url)) {
    console.log('Skipping internal URL:', bookmark.url);
    return;
  }

  console.log('Bookmark moved to root folder, organizing:', bookmark.url);
  await processBookmark(id, bookmark.url, bookmark.title);
});

async function processBookmark(id: string, url: string, title?: string): Promise<void> {
  try {
    // Load configuration
    const config = await chrome.storage.sync.get(['workerUrl', 'apiKey']);

    if (!config.workerUrl || !config.apiKey) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Configuration Required',
        message: 'Please configure your Worker URL and API Key in the extension options.',
      });

      // Open options page
      chrome.runtime.openOptionsPage();
      return;
    }

    const language = chrome.i18n.getUILanguage();

    const response = await fetch(`${config.workerUrl}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
      body: JSON.stringify({
        url: url,
        title: title,
        language: language,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: BookmarkResponse = await response.json();

    await organizeBookmark(id, data);

    await saveLastBookmark(data);

    await updateLocalBookmarkData(data);

    await showNotification(data);

  } catch (error) {
    console.error('Failed to process bookmark:', error);
  }
}

function isInternalUrl(url: string): boolean {
  const internalPrefixes = ['chrome://', 'about:', 'file://', 'javascript:', 'data:'];
  return internalPrefixes.some(prefix => url.startsWith(prefix));
}

async function organizeBookmark(bookmarkId: string, data: BookmarkResponse): Promise<void> {
  if (!otherBookmarksFolderId) {
    otherBookmarksFolderId = await getOrCreateRootFolder();
  }

  const tagFolderId = await getOrCreateTagFolder(data.primary_tag);

  await chrome.bookmarks.move(bookmarkId, { parentId: tagFolderId });
}

async function getOrCreateRootFolder(): Promise<string> {
  const tree = await chrome.bookmarks.getTree();
  const otherBookmarks = tree[0].children?.[1]; // Other Bookmarks folder

  if (!otherBookmarks) {
    throw new Error('Other Bookmarks folder not found');
  }

  return otherBookmarks.id;
}

async function getOrCreateTagFolder(tag: string): Promise<string> {
  if (folderCache.has(tag)) {
    return folderCache.get(tag)!;
  }

  if (!otherBookmarksFolderId) {
    otherBookmarksFolderId = await getOrCreateRootFolder();
  }

  const children = await chrome.bookmarks.getChildren(otherBookmarksFolderId);
  const existing = children.find(child => child.title === tag && !child.url);

  if (existing) {
    folderCache.set(tag, existing.id);
    return existing.id;
  }

  const folder = await chrome.bookmarks.create({
    parentId: otherBookmarksFolderId,
    title: tag,
  });

  folderCache.set(tag, folder.id);
  return folder.id;
}

async function saveLastBookmark(data: BookmarkResponse): Promise<void> {
  const lastBookmark: LastBookmark = {
    title: data.title,
    url: data.url,
    tags: data.tags,
    timestamp: Date.now(),
  };

  await chrome.storage.local.set({ lastBookmark });
}

async function showNotification(data: BookmarkResponse): Promise<void> {
  const tagNames = data.tags.map(t => t.name).join(', ');

  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Bookmark Saved',
    message: `Tags: ${tagNames}`,
  });
}

async function isBookmarkInRootFolder(parentId: string | undefined): Promise<boolean> {
  if (!parentId) return false;

  try {
    const tree = await chrome.bookmarks.getTree();
    const otherBookmarks = tree[0].children?.[1]; // Other Bookmarks folder

    // Only check if bookmark is in Other Bookmarks root directory
    return parentId === otherBookmarks?.id;
  } catch (error) {
    console.error('Failed to check bookmark location:', error);
    return false;
  }
}

async function updateLocalBookmarkData(bookmark: BookmarkResponse): Promise<void> {
  const result = await chrome.storage.local.get('bookmarkData');
  const bookmarkData: LocalBookmarkData = result.bookmarkData || { tags: {}, lastSync: 0 };

  // Add bookmark to each of its tags
  for (const tag of bookmark.tags) {
    if (!bookmarkData.tags[tag.name]) {
      bookmarkData.tags[tag.name] = [];
    }

    // Check if bookmark already exists (by URL)
    const exists = bookmarkData.tags[tag.name].some(b => b.url === bookmark.url);
    if (!exists) {
      bookmarkData.tags[tag.name].push({
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
      });
    }
  }

  bookmarkData.lastSync = Date.now();
  await chrome.storage.local.set({ bookmarkData });
}
