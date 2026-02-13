import type { BookmarkResponse, LocalBookmarkData } from './types';

document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');
  if (!content) return;

  try {
    const result = await chrome.storage.local.get('bookmarkData');
    const bookmarkData: LocalBookmarkData | undefined = result.bookmarkData;

    if (!bookmarkData || Object.keys(bookmarkData.tags).length === 0) {
      content.innerHTML = '<div class="empty">No bookmarks yet</div>';
    } else {
      renderTagList(content, bookmarkData);
    }
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    content.innerHTML = '<div class="empty">Error loading bookmarks</div>';
  }

  // Setup sync button
  const syncButton = document.getElementById('syncButton') as HTMLButtonElement;
  if (syncButton) {
    // Check if configuration is complete
    const config = await chrome.storage.sync.get(['workerUrl', 'apiKey']);
    if (!config.workerUrl || !config.apiKey) {
      syncButton.disabled = true;
      syncButton.textContent = 'Configure Extension First';
    } else {
      syncButton.addEventListener('click', handleSync);
    }
  }

  // Setup settings button
  const settingsButton = document.getElementById('settingsButton') as HTMLButtonElement;
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
});

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderTagList(container: HTMLElement, data: LocalBookmarkData): void {
  // Sort tags by bookmark count (descending)
  const tags = Object.keys(data.tags).sort((a, b) => {
    return data.tags[b].length - data.tags[a].length;
  });

  let html = '<div class="tag-list">';
  for (const tagName of tags) {
    const bookmarks = data.tags[tagName];
    html += `
      <div class="tag-badge" data-tag="${escapeHtml(tagName)}">
        <span class="tag-badge-name">${escapeHtml(tagName)}</span>
        <span class="tag-badge-count">${bookmarks.length}</span>
      </div>
    `;
  }
  html += '</div>';
  html += '<div class="filtered-bookmarks" id="filteredBookmarks" style="display: none;"></div>';

  container.innerHTML = html;

  let selectedTag: string | null = null;

  // Add click handlers for tag badges
  container.querySelectorAll('.tag-badge').forEach(badge => {
    badge.addEventListener('click', () => {
      const tagName = badge.getAttribute('data-tag');
      if (!tagName) return;

      // Toggle selection
      if (selectedTag === tagName) {
        // Deselect
        selectedTag = null;
        badge.classList.remove('active');
        hideFilteredBookmarks();
      } else {
        // Select new tag
        // Remove active class from all badges
        container.querySelectorAll('.tag-badge').forEach(b => b.classList.remove('active'));

        selectedTag = tagName;
        badge.classList.add('active');
        showFilteredBookmarks(tagName, data.tags[tagName]);
      }
    });
  });
}

function showFilteredBookmarks(tagName: string, bookmarks: Array<{ id: number; url: string; title: string }>): void {
  const filteredContainer = document.getElementById('filteredBookmarks');
  if (!filteredContainer) return;

  let html = `<div class="filtered-bookmarks-title">${escapeHtml(tagName)} (${bookmarks.length})</div>`;

  for (const bookmark of bookmarks) {
    html += `
      <div class="bookmark-item" data-url="${escapeHtml(bookmark.url)}">
        <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
        <div class="bookmark-url">${escapeHtml(bookmark.url)}</div>
      </div>
    `;
  }

  filteredContainer.innerHTML = html;
  filteredContainer.style.display = 'block';

  // Add click handlers for bookmark items
  filteredContainer.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.getAttribute('data-url');
      if (url) {
        chrome.tabs.create({ url });
      }
    });
  });
}

function hideFilteredBookmarks(): void {
  const filteredContainer = document.getElementById('filteredBookmarks');
  if (filteredContainer) {
    filteredContainer.style.display = 'none';
    filteredContainer.innerHTML = '';
  }
}

async function clearTagFolders(): Promise<void> {
  const tree = await chrome.bookmarks.getTree();
  const otherBookmarks = tree[0].children?.[1]; // Other Bookmarks folder

  if (!otherBookmarks || !otherBookmarks.id) {
    return;
  }

  const children = await chrome.bookmarks.getChildren(otherBookmarks.id);

  // Only delete folders (not bookmarks) that were created by the extension
  // We identify these as folders without URLs
  for (const child of children) {
    if (!child.url) {
      // This is a folder, delete it
      await chrome.bookmarks.removeTree(child.id);
    }
  }
}

async function recreateBookmarks(
  bookmarks: BookmarkResponse[],
  onProgress: (progress: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // Get Other Bookmarks folder
  const tree = await chrome.bookmarks.getTree();
  const otherBookmarks = tree[0].children?.[1]; // Other Bookmarks folder

  if (!otherBookmarks) {
    throw new Error('Other Bookmarks folder not found');
  }

  // Group bookmarks by primary tag
  const bookmarksByTag = new Map<string, BookmarkResponse[]>();
  for (const bookmark of bookmarks) {
    if (!bookmark.primary_tag) {
      continue
    }
    const tag = bookmark.primary_tag;
    if (!bookmarksByTag.has(tag)) {
      bookmarksByTag.set(tag, []);
    }
    bookmarksByTag.get(tag)!.push(bookmark);
  }

  // Create folders and bookmarks
  let processed = 0;
  for (const [tag, tagBookmarks] of bookmarksByTag) {
    try {
      // Create tag folder directly in Other Bookmarks
      const tagFolder = await chrome.bookmarks.create({
        parentId: otherBookmarks.id,
        title: tag,
      });

      // Create bookmarks in tag folder
      for (const bookmark of tagBookmarks) {
        try {
          await chrome.bookmarks.create({
            parentId: tagFolder.id,
            title: bookmark.title,
            url: bookmark.url,
          });
          success++;
        } catch (error) {
          console.error(`Failed to create bookmark: ${bookmark.title}`, error);
          failed++;
        }
        processed++;
        onProgress(processed / bookmarks.length);
      }
    } catch (error) {
      console.error(`Failed to create folder for tag: ${tag}`, error);
      failed += tagBookmarks.length;
      processed += tagBookmarks.length;
      onProgress(processed / bookmarks.length);
    }
  }

  // Update local bookmark data
  const bookmarkData: LocalBookmarkData = {
    tags: {},
    lastSync: Date.now(),
  };

  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      if (!bookmarkData.tags[tag.name]) {
        bookmarkData.tags[tag.name] = [];
      }
      bookmarkData.tags[tag.name].push({
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
      });
    }
  }

  await chrome.storage.local.set({ bookmarkData });

  return { success, failed };
}

async function handleSync() {
  const syncButton = document.getElementById('syncButton') as HTMLButtonElement;
  const syncStatus = document.getElementById('syncStatus') as HTMLDivElement;
  const syncProgress = document.getElementById('syncProgress') as HTMLDivElement;
  const syncProgressBar = document.getElementById('syncProgressBar') as HTMLDivElement;
  const syncResult = document.getElementById('syncResult') as HTMLDivElement;

  // Show confirmation dialog
  const confirmed = confirm(
    'This will clear tag folders in Other Bookmarks and download all bookmarks from the server. Continue?'
  );

  if (!confirmed) {
    return;
  }

  // Disable button and show progress
  syncButton.disabled = true;
  syncButton.textContent = 'Syncing...';
  syncStatus.style.display = 'block';
  syncProgress.style.display = 'block';
  syncResult.style.display = 'none';

  try {
    // Step 1: Fetch bookmarks from server
    syncStatus.textContent = 'Fetching bookmarks from server...';
    syncProgressBar.style.width = '10%';

    const config = await chrome.storage.sync.get(['workerUrl', 'apiKey']);
    const response = await fetch(`${config.workerUrl}/api/bookmarks`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API Key');
      }
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    const bookmarks: BookmarkResponse[] = data.bookmarks || [];

    syncProgressBar.style.width = '20%';

    if (bookmarks.length === 0) {
      syncStatus.textContent = 'No bookmarks to sync';
      syncResult.style.display = 'block';
      syncResult.className = 'sync-result success';
      syncResult.textContent = 'No bookmarks found on server';
      syncButton.disabled = false;
      syncButton.textContent = 'Sync Bookmarks';
      return;
    }

    // Step 2: Clear tag folders in Other Bookmarks
    syncStatus.textContent = 'Clearing local bookmarks...';
    syncProgressBar.style.width = '30%';

    await clearTagFolders();

    syncProgressBar.style.width = '40%';

    // Step 3: Recreate bookmarks
    syncStatus.textContent = `Creating ${bookmarks.length} bookmarks...`;

    const result = await recreateBookmarks(bookmarks, (progress) => {
      const progressPercent = 40 + (progress * 50);
      syncProgressBar.style.width = `${progressPercent}%`;
      syncStatus.textContent = `Creating bookmarks: ${Math.round(progress * 100)}%`;
    });

    syncProgressBar.style.width = '100%';

    // Show result
    syncResult.style.display = 'block';
    if (result.failed === 0) {
      syncResult.className = 'sync-result success';
      syncResult.textContent = `Successfully synced ${result.success} bookmarks`;
    } else {
      syncResult.className = 'sync-result error';
      syncResult.textContent = `Synced ${result.success} bookmarks, ${result.failed} failed`;
    }

    syncStatus.textContent = 'Sync complete';

    // Show notification
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Sync Complete',
      message: `Synced ${result.success} bookmarks`,
    });

    // Refresh the content display
    const content = document.getElementById('content');
    if (content) {
      const updatedResult = await chrome.storage.local.get('bookmarkData');
      const bookmarkData: LocalBookmarkData | undefined = updatedResult.bookmarkData;
      if (bookmarkData && Object.keys(bookmarkData.tags).length > 0) {
        renderTagList(content, bookmarkData);
      }
    }

  } catch (error) {
    console.error('Sync failed:', error);
    syncResult.style.display = 'block';
    syncResult.className = 'sync-result error';
    syncResult.textContent = error instanceof Error ? error.message : 'Sync failed';
    syncStatus.textContent = 'Sync failed';
  } finally {
    syncButton.disabled = false;
    syncButton.textContent = 'Sync Bookmarks';
    setTimeout(() => {
      syncProgress.style.display = 'none';
    }, 2000);
  }
}
