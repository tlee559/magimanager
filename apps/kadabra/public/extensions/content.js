/**
 * MagiManager Extension - Content Script
 * Runs on Google Ads pages to detect the current Customer ID (CID)
 */

// Extract CID from URL
function extractCidFromUrl() {
  const url = new URL(window.location.href);

  // Try different URL patterns Google Ads uses
  // Pattern 1: ?ocid=1234567890
  const ocid = url.searchParams.get('ocid');
  if (ocid) return ocid;

  // Pattern 2: ?__c=1234567890
  const underscoreC = url.searchParams.get('__c');
  if (underscoreC) return underscoreC;

  // Pattern 3: /aw/overview?customer=123-456-7890
  const customer = url.searchParams.get('customer');
  if (customer) return customer;

  // Pattern 4: URL path contains /aw/... with CID embedded
  // e.g., /aw/overview/1234567890
  const pathMatch = url.pathname.match(/\/aw\/[^\/]+\/(\d{10})/);
  if (pathMatch) return pathMatch[1];

  return null;
}

// Format CID with dashes for display
function formatCid(cid) {
  const clean = cid.replace(/-/g, '');
  if (clean.length !== 10) return cid;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
}

// Store detected CID and notify popup
function updateDetectedCid() {
  const cid = extractCidFromUrl();
  if (cid) {
    chrome.storage.local.set({
      detectedCid: cid,
      detectedCidFormatted: formatCid(cid),
      lastDetectedUrl: window.location.href,
      lastDetectedTime: Date.now()
    });
  }
}

// Initial detection
updateDetectedCid();

// Re-detect on URL changes (SPA navigation)
let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    updateDetectedCid();
  }
}).observe(document.body, { subtree: true, childList: true });

// Also listen for history changes
window.addEventListener('popstate', updateDetectedCid);

// Respond to popup queries
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_CID') {
    const cid = extractCidFromUrl();
    sendResponse({
      cid: cid,
      cidFormatted: cid ? formatCid(cid) : null,
      url: window.location.href
    });
  }
  return true;
});
