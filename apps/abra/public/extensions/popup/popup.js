/**
 * MagiManager Extension - Popup Script
 * Shows detected CID and connect button
 */

// Change to 'http://localhost:3000' for local testing
const MAGIMANAGER_URL = 'https://abra.magimanager.com';

// Format CID with dashes for display
function formatCid(cid) {
  const clean = cid.replace(/-/g, '');
  if (clean.length !== 10) return cid;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
}

// SVG icons
const icons = {
  link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  alert: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  external: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
};

// Render the popup content
function render(state) {
  const content = document.getElementById('content');

  if (state.error) {
    content.innerHTML = `
      <div class="status-box error-state">
        <div class="error-text">${state.error}</div>
      </div>
    `;
    return;
  }

  if (!state.isOnGoogleAds) {
    content.innerHTML = `
      <div class="nav-prompt">
        <div class="nav-prompt-icon">${icons.alert}</div>
        <p class="not-detected">Navigate to Google Ads to connect an account</p>
        <p class="info-text" style="margin-top: 8px;">
          Open ads.google.com and select an account to connect.
        </p>
      </div>
    `;
    return;
  }

  if (!state.cid) {
    content.innerHTML = `
      <div class="nav-prompt">
        <div class="nav-prompt-icon">${icons.alert}</div>
        <p class="not-detected">No account detected</p>
        <p class="info-text" style="margin-top: 8px;">
          Make sure you're viewing a specific Google Ads account (not the MCC overview).
        </p>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="status-box">
      <div class="status-label">Detected Account</div>
      <div class="cid-display">${formatCid(state.cid)}</div>
    </div>
    <button class="connect-btn" id="connectBtn">
      ${icons.link}
      Connect to MagiManager
    </button>
    <p class="info-text">
      This will open a Google sign-in window to grant MagiManager read access to this account's metrics.
    </p>
  `;

  document.getElementById('connectBtn').addEventListener('click', () => {
    // Open OAuth flow in new tab
    const oauthUrl = `${MAGIMANAGER_URL}/api/oauth/google-ads/authorize?cid=${encodeURIComponent(state.cid)}`;
    chrome.tabs.create({ url: oauthUrl });
    window.close();
  });
}

// Initialize popup
async function init() {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we're on Google Ads
    const isOnGoogleAds = tab.url && tab.url.includes('ads.google.com');

    if (!isOnGoogleAds) {
      render({ isOnGoogleAds: false });
      return;
    }

    // Try to get CID from content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CID' });
      render({
        isOnGoogleAds: true,
        cid: response.cid
      });
    } catch (e) {
      // Content script might not be loaded yet, try storage
      const stored = await chrome.storage.local.get(['detectedCid', 'lastDetectedUrl']);

      // Only use stored CID if it's from the current URL
      if (stored.detectedCid && stored.lastDetectedUrl === tab.url) {
        render({
          isOnGoogleAds: true,
          cid: stored.detectedCid
        });
      } else {
        render({
          isOnGoogleAds: true,
          cid: null
        });
      }
    }
  } catch (error) {
    render({ error: error.message });
  }
}

init();
