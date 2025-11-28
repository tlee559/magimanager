# MagiManager Chrome Extension

Connect Google Ads accounts to MagiManager for automatic syncing.

## Installation (Developer Mode)

1. **Generate Icons**
   - Open `icons/generate-icons.html` in Chrome
   - Right-click each canvas and save as the indicated filename (icon16.png, icon48.png, icon128.png)
   - Save them to the `icons/` folder

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this `magimanager-extension` folder

3. **Usage**
   - Navigate to Google Ads (ads.google.com)
   - Select a specific account (not MCC overview)
   - Click the MagiManager extension icon
   - Click "Connect to MagiManager"
   - Complete the Google OAuth consent
   - Account is now connected and will sync automatically

## How It Works

1. **Content Script** (`content.js`) - Runs on Google Ads pages and detects the Customer ID (CID) from the URL

2. **Popup** (`popup/`) - Shows the detected CID and a "Connect" button

3. **OAuth Flow** - When you click Connect:
   - Opens MagiManager's OAuth authorization endpoint
   - Google shows consent screen requesting ad account access
   - After approval, tokens are stored securely
   - Account is linked to your MagiManager account

## Development

The extension communicates with the MagiManager backend at `https://abra.magimanager.com`.

For local development, update `MAGIMANAGER_URL` in `popup/popup.js` to `http://localhost:3000`.
