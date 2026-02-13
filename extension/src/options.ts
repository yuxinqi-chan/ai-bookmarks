interface Config {
  workerUrl: string;
  apiKey: string;
}

const form = document.getElementById('configForm') as HTMLFormElement;
const workerUrlInput = document.getElementById('workerUrl') as HTMLInputElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const testBtn = document.getElementById('testBtn') as HTMLButtonElement;
const messageDiv = document.getElementById('message') as HTMLDivElement;

// Load saved configuration
async function loadConfig(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(['workerUrl', 'apiKey']);
    if (result.workerUrl) {
      workerUrlInput.value = result.workerUrl;
    }
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

// Save configuration
async function saveConfig(config: Config): Promise<void> {
  await chrome.storage.sync.set(config);
}

// Show message
function showMessage(text: string, type: 'success' | 'error'): void {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type} show`;

  setTimeout(() => {
    messageDiv.classList.remove('show');
  }, 5000);
}

// Test connection
async function testConnection(config: Config): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${config.workerUrl}/health`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, message: 'Invalid API Key' };
      }
      const errorText = await response.text().catch(() => response.statusText);
      return { success: false, message: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    if (data.status === 'ok') {
      return { success: true, message: 'Connection successful!' };
    } else {
      return { success: false, message: 'Unexpected response from server' };
    }
  } catch (error) {
    console.error('Connection test failed:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { success: false, message: 'Cannot reach server. Check URL and network connection.' };
    }
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Form submit handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const workerUrl = workerUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!workerUrl || !apiKey) {
    showMessage('Please fill in all required fields', 'error');
    return;
  }

  // Validate URL format
  try {
    new URL(workerUrl);
  } catch {
    showMessage('Invalid Worker URL format', 'error');
    return;
  }

  const config: Config = { workerUrl, apiKey };

  try {
    await saveConfig(config);
    showMessage('Configuration saved successfully!', 'success');
  } catch (error) {
    console.error('Failed to save config:', error);
    showMessage('Failed to save configuration', 'error');
  }
});

// Test button handler
testBtn.addEventListener('click', async () => {
  const workerUrl = workerUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!workerUrl || !apiKey) {
    showMessage('Please fill in all required fields', 'error');
    return;
  }

  const config: Config = { workerUrl, apiKey };

  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';

  const result = await testConnection(config);

  testBtn.disabled = false;
  testBtn.textContent = 'Test Connection';

  if (result.success) {
    showMessage(result.message, 'success');
  } else {
    showMessage(result.message, 'error');
  }
});

// Load config on page load
loadConfig();
