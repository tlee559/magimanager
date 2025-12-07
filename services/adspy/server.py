"""
AdSpy Python Service v2.1
Searches Google for sponsored ads using Playwright browser automation.
Includes stealth measures to bypass bot detection.
"""

import asyncio
import base64
import os
import random
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse, parse_qs, quote_plus

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright, Page, BrowserContext

# Configuration
ADSPY_API_KEY = os.environ.get("ADSPY_API_KEY", "adspy-dev-key")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))

# FastAPI app
app = FastAPI(title="AdSpy Service", version="2.1.0")

# Realistic user agents pool
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]


async def apply_stealth_scripts(page: Page):
    """
    Apply stealth JavaScript to evade bot detection.
    These scripts make the browser appear more human-like.
    """
    # Override webdriver property
    await page.add_init_script("""
        // Override webdriver detection
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        // Override automation-related properties
        delete navigator.__proto__.webdriver;

        // Add missing plugins that headless Chrome lacks
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                { name: 'Native Client', filename: 'internal-nacl-plugin' },
            ]
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        // Override platform for consistency
        Object.defineProperty(navigator, 'platform', {
            get: () => 'Win32'
        });

        // Override permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Override chrome runtime
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };

        // Override console.debug to prevent detection via stack trace
        const originalConsoleDebug = console.debug;
        console.debug = function(...args) {
            if (args[0] && typeof args[0] === 'string' && args[0].includes('Puppeteer')) {
                return;
            }
            return originalConsoleDebug.apply(console, args);
        };
    """)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://magimanager.com",
        "https://www.magimanager.com",
        "https://kadabra.magimanager.com",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    api_key: str
    keyword: str
    location: str = "us"
    num_results: int = 10


class SearchResponse(BaseModel):
    success: bool
    keyword: str
    ads: list
    timestamp: str
    source: str = "playwright"
    error: Optional[str] = None
    debug_info: Optional[dict] = None


@app.get("/health")
async def health_check():
    """Health check endpoint for Railway."""
    return {
        "status": "healthy",
        "service": "adspy",
        "version": "2.1.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/search", response_model=SearchResponse)
async def search_ads(request: SearchRequest):
    """
    Search Google for sponsored ads using Playwright browser automation.
    """
    # Validate API key
    if request.api_key != ADSPY_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    debug_info = {"method": "playwright", "pages_scanned": 0, "raw_ads_found": 0}

    try:
        # Use Playwright to scan Google for sponsored ads
        ads = await scan_google_for_sponsored_ads(
            keyword=request.keyword,
            location=request.location,
            max_pages=3,
            debug_info=debug_info
        )

        debug_info["ads_after_processing"] = len(ads)

        if not ads:
            return SearchResponse(
                success=True,
                keyword=request.keyword,
                ads=[],
                timestamp=datetime.utcnow().isoformat(),
                source="playwright",
                debug_info=debug_info,
            )

        # Limit results
        ads = ads[: request.num_results]

        # Take screenshots of landing pages
        ads_with_screenshots = await capture_landing_screenshots(ads)

        return SearchResponse(
            success=True,
            keyword=request.keyword,
            ads=ads_with_screenshots,
            timestamp=datetime.utcnow().isoformat(),
            source="playwright",
            debug_info=debug_info,
        )

    except Exception as e:
        import traceback
        debug_info["error_traceback"] = traceback.format_exc()
        return SearchResponse(
            success=False,
            keyword=request.keyword,
            ads=[],
            timestamp=datetime.utcnow().isoformat(),
            source="playwright",
            error=str(e),
            debug_info=debug_info,
        )


async def scan_google_for_sponsored_ads(
    keyword: str,
    location: str = "us",
    max_pages: int = 3,
    debug_info: dict = None
) -> List[Dict[str, Any]]:
    """
    Scan Google search results using Playwright to find "Sponsored results" section.
    This mimics what a real user sees in Google search.
    """
    all_ads = []

    # Map location codes to Google domains
    location_map = {
        "us": {"domain": "google.com", "gl": "us", "hl": "en"},
        "uk": {"domain": "google.co.uk", "gl": "uk", "hl": "en"},
        "ca": {"domain": "google.ca", "gl": "ca", "hl": "en"},
        "au": {"domain": "google.com.au", "gl": "au", "hl": "en"},
        "de": {"domain": "google.de", "gl": "de", "hl": "de"},
        "fr": {"domain": "google.fr", "gl": "fr", "hl": "fr"},
        "es": {"domain": "google.es", "gl": "es", "hl": "es"},
        "it": {"domain": "google.it", "gl": "it", "hl": "it"},
        "br": {"domain": "google.com.br", "gl": "br", "hl": "pt"},
        "mx": {"domain": "google.com.mx", "gl": "mx", "hl": "es"},
        "in": {"domain": "google.co.in", "gl": "in", "hl": "en"},
        "jp": {"domain": "google.co.jp", "gl": "jp", "hl": "ja"},
    }

    loc_settings = location_map.get(location, location_map["us"])

    async with async_playwright() as p:
        # Launch browser with anti-detection settings
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--disable-infobars",
                "--disable-background-networking",
                "--disable-default-apps",
                "--disable-extensions",
                "--disable-sync",
                "--no-first-run",
                "--disable-gpu",
                "--disable-setuid-sandbox",
                "--no-sandbox",
                "--window-size=1920,1080",
            ]
        )

        # Random user agent for each session
        user_agent = random.choice(USER_AGENTS)

        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=user_agent,
            locale="en-US",
            timezone_id="America/New_York",
            # Geolocation to match the search location
            geolocation={"latitude": 40.7128, "longitude": -74.0060} if location == "us" else None,
            permissions=["geolocation"] if location == "us" else [],
            # Accept language header
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Cache-Control": "max-age=0",
            }
        )

        page = await context.new_page()

        # Apply stealth scripts to evade bot detection
        await apply_stealth_scripts(page)

        try:
            # First, visit Google homepage to get cookies (more natural behavior)
            google_home = f"https://www.{loc_settings['domain']}"
            if debug_info is not None:
                debug_info["visiting_homepage"] = google_home

            await page.goto(google_home, timeout=30000, wait_until="domcontentloaded")

            # Random delay to simulate human reading the page
            await asyncio.sleep(random.uniform(1.5, 3.0))

            # Handle cookie consent before searching
            await handle_cookie_consent(page)

            # Simulate human-like behavior: move mouse, scroll slightly
            await page.mouse.move(random.randint(100, 500), random.randint(100, 400))
            await asyncio.sleep(random.uniform(0.3, 0.8))

            for page_num in range(max_pages):
                start = page_num * 10
                encoded_keyword = quote_plus(keyword)

                # Build Google search URL
                search_url = f"https://www.{loc_settings['domain']}/search?q={encoded_keyword}&gl={loc_settings['gl']}&hl={loc_settings['hl']}&start={start}"

                if debug_info is not None:
                    debug_info[f"url_page_{page_num}"] = search_url
                    debug_info["user_agent"] = user_agent

                await page.goto(search_url, timeout=30000, wait_until="domcontentloaded")

                # Random human-like delay
                await asyncio.sleep(random.uniform(2.0, 4.0))

                # Simulate scrolling to load lazy content
                await page.mouse.wheel(0, random.randint(100, 300))
                await asyncio.sleep(random.uniform(0.5, 1.0))

                if debug_info is not None:
                    debug_info["pages_scanned"] = page_num + 1

                # Debug: capture what the page looks like
                if debug_info is not None and page_num == 0:
                    try:
                        body_text = await page.inner_text("body")
                        debug_info["page_text_sample"] = body_text[:1000] if body_text else "No body text"
                        debug_info["has_sponsored_text"] = "Sponsored" in body_text if body_text else False
                        debug_info["has_ad_text"] = "Ad" in body_text if body_text else False

                        # Take a screenshot of the search results for debugging
                        screenshot = await page.screenshot(type="jpeg", quality=60)
                        debug_info["serp_screenshot_base64"] = base64.b64encode(screenshot).decode()
                    except Exception as e:
                        debug_info["debug_error"] = str(e)

                # Method 1: Find the "Sponsored" section header and get ads below it
                sponsored_ads = await find_sponsored_section_ads(page, page_num)
                if sponsored_ads:
                    for ad in sponsored_ads:
                        if not any(a.get("link") == ad.get("link") for a in all_ads):
                            all_ads.append(ad)

                # Method 2: Find ads by looking for sponsored/ad indicators in individual results
                indicator_ads = await find_ads_by_indicators(page, page_num)
                if indicator_ads:
                    for ad in indicator_ads:
                        if not any(a.get("link") == ad.get("link") for a in all_ads):
                            all_ads.append(ad)

                # Method 3: Find ads in the top ad block (data attributes)
                top_ads = await find_top_ad_block(page, page_num)
                if top_ads:
                    for ad in top_ads:
                        if not any(a.get("link") == ad.get("link") for a in all_ads):
                            all_ads.append(ad)

                if debug_info is not None:
                    debug_info["raw_ads_found"] = len(all_ads)

                # If we found enough ads, stop scanning more pages
                if len(all_ads) >= 10:
                    break

        except Exception as e:
            print(f"Error scanning Google: {e}")
            if debug_info is not None:
                debug_info["scan_error"] = str(e)
        finally:
            await browser.close()

    # Assign positions
    for i, ad in enumerate(all_ads):
        ad["position"] = i + 1

    return all_ads


async def handle_cookie_consent(page):
    """Handle cookie consent dialogs that might appear."""
    try:
        # Common cookie consent button selectors
        consent_selectors = [
            "button:has-text('Accept all')",
            "button:has-text('Accept')",
            "button:has-text('I agree')",
            "button:has-text('Agree')",
            "[aria-label='Accept all']",
            "#L2AGLb",  # Google's consent button ID
        ]

        for selector in consent_selectors:
            try:
                btn = page.locator(selector).first
                if await btn.is_visible(timeout=1000):
                    await btn.click()
                    await asyncio.sleep(1)
                    break
            except:
                continue
    except:
        pass


async def find_sponsored_section_ads(page, page_num: int) -> List[Dict[str, Any]]:
    """
    Find ads in the "Sponsored results" or "Sponsored" labeled section.
    This is the modern Google ad format shown in the user's screenshot.
    """
    ads = []

    try:
        # Look for "Sponsored" text anywhere on the page
        # Google shows "Sponsored results" or just "Sponsored" above ads
        page_content = await page.content()

        # Find all elements that might be sponsored ad containers
        # These typically have a structure with site name, URL, title, description, and sitelinks

        # Strategy: Find divs that contain "Sponsored" text and extract ad info from siblings/children
        sponsored_elements = await page.query_selector_all("div")

        for element in sponsored_elements:
            try:
                # Check if this element or its children contain "Sponsored" indicator
                element_text = await element.inner_text()

                # Skip if too long (probably a container with many results)
                if len(element_text) > 2000:
                    continue

                # Check for sponsored indicators
                is_sponsored = False
                if "Sponsored" in element_text and len(element_text) < 1500:
                    # Make sure it's actually an ad container, not just mentioning the word
                    has_link = await element.query_selector("a[href]")
                    if has_link:
                        is_sponsored = True

                if not is_sponsored:
                    continue

                # Try to extract ad data from this container
                ad_data = await extract_modern_ad_data(element, page_num)
                if ad_data and ad_data.get("link") and ad_data.get("title"):
                    # Filter out Google's own links
                    if "google.com" not in ad_data.get("link", ""):
                        ads.append(ad_data)

            except Exception as e:
                continue

    except Exception as e:
        print(f"Error in find_sponsored_section_ads: {e}")

    return ads


async def find_ads_by_indicators(page, page_num: int) -> List[Dict[str, Any]]:
    """
    Find ads by looking for specific ad indicators in search results.
    """
    ads = []

    try:
        # Look for results with "Ad" badge or sponsored indicator
        # Modern Google uses various class names and data attributes

        # Try multiple selector strategies
        selectors = [
            # Results with data-text-ad attribute
            "[data-text-ad='1']",
            # Results with ad-related classes
            ".uEierd",  # Ad container class
            ".commercial-unit-desktop-top",
            # Results containing "Ad" span
            "div:has(> span:text-is('Ad'))",
        ]

        for selector in selectors:
            try:
                elements = await page.query_selector_all(selector)
                for element in elements:
                    ad_data = await extract_modern_ad_data(element, page_num)
                    if ad_data and ad_data.get("link") and ad_data.get("title"):
                        if "google.com" not in ad_data.get("link", ""):
                            ads.append(ad_data)
            except:
                continue

    except Exception as e:
        print(f"Error in find_ads_by_indicators: {e}")

    return ads


async def find_top_ad_block(page, page_num: int) -> List[Dict[str, Any]]:
    """
    Find ads in the top ad block using data attributes.
    """
    ads = []

    try:
        # Google's top ads block often has specific structure
        # Look for the main search results container and find sponsored items

        # Try to find ad blocks by their container ID or class
        ad_containers = await page.query_selector_all("#tads, #tadsb, [data-hveid]")

        for container in ad_containers:
            try:
                # Check if this container has sponsored content
                text = await container.inner_text()
                if "Sponsored" in text or len(text) < 50:
                    # Find individual ads within this container
                    ad_items = await container.query_selector_all("a[data-rw]")
                    if not ad_items:
                        ad_items = await container.query_selector_all("[data-dtld]")

                    for item in ad_items:
                        ad_data = await extract_modern_ad_data(item, page_num)
                        if ad_data and ad_data.get("link") and ad_data.get("title"):
                            if "google.com" not in ad_data.get("link", ""):
                                ads.append(ad_data)
            except:
                continue

    except Exception as e:
        print(f"Error in find_top_ad_block: {e}")

    return ads


async def extract_modern_ad_data(element, page_num: int) -> Optional[Dict[str, Any]]:
    """
    Extract ad data from a modern Google ad element.
    Captures: site name, URL, headline, description, sitelinks.
    """
    try:
        ad_data = {
            "position": 0,
            "block_position": "top" if page_num == 0 else f"page_{page_num + 1}",
            "source": "playwright",
        }

        # Get the main link (headline link)
        link = ""
        title = ""

        # Try different strategies to find the headline link
        link_selectors = [
            "a[data-rw]",  # Main ad link
            "a h3",  # Link containing h3
            "a[href^='http']:has(h3)",
            "a[href^='http']",
        ]

        for selector in link_selectors:
            try:
                link_el = await element.query_selector(selector)
                if link_el:
                    href = await link_el.get_attribute("href")
                    if href and "google.com/aclk" in href:
                        # Extract real URL from Google's redirect
                        link = extract_real_url(href)
                    elif href and href.startswith("http"):
                        link = href

                    # Get title from h3 or the link text
                    h3 = await link_el.query_selector("h3")
                    if h3:
                        title = await h3.inner_text()
                    else:
                        title = await link_el.inner_text()

                    if link and title:
                        break
            except:
                continue

        if not link:
            return None

        ad_data["link"] = link
        ad_data["title"] = title.strip() if title else ""

        # Get displayed URL (the green URL shown to users)
        try:
            # Look for cite element or span with URL
            cite_selectors = ["cite", "span.VuuXrf", "[data-dtld]", ".Zu0yb"]
            for sel in cite_selectors:
                cite_el = await element.query_selector(sel)
                if cite_el:
                    displayed = await cite_el.inner_text()
                    if displayed:
                        ad_data["displayed_link"] = displayed.strip()
                        break

            if "displayed_link" not in ad_data:
                ad_data["displayed_link"] = urlparse(link).netloc
        except:
            ad_data["displayed_link"] = urlparse(link).netloc

        # Get site name/source (the bold name above the URL)
        try:
            # Site name is usually in a span before the URL
            site_selectors = ["span.VuuXrf", "[role='text']"]
            for sel in site_selectors:
                site_el = await element.query_selector(sel)
                if site_el:
                    site_name = await site_el.inner_text()
                    if site_name and len(site_name) < 100:
                        ad_data["site_name"] = site_name.strip()
                        break
        except:
            pass

        # Get description
        try:
            # Description is usually in a div after the title
            desc_selectors = [".VwiC3b", "[data-sncf]", "div.Va3FIb", "div > span"]
            for sel in desc_selectors:
                desc_el = await element.query_selector(sel)
                if desc_el:
                    desc = await desc_el.inner_text()
                    # Filter out short strings that aren't descriptions
                    if desc and len(desc) > 30 and "Sponsored" not in desc:
                        ad_data["description"] = desc.strip()[:500]  # Limit length
                        break
        except:
            pass

        # Get sitelinks (the links at the bottom like "Best Online Casinos", "Sweepstakes No Deposit")
        try:
            sitelinks = []
            # Sitelinks are usually in a row of links after the main ad
            sitelink_els = await element.query_selector_all("a")

            for sl_el in sitelink_els:
                try:
                    sl_href = await sl_el.get_attribute("href")
                    sl_text = await sl_el.inner_text()

                    # Skip if it's the main ad link or not a valid sitelink
                    if not sl_href or not sl_text:
                        continue
                    if sl_text == title:
                        continue
                    if len(sl_text) > 50:
                        continue
                    if "google.com" in sl_href and "aclk" not in sl_href:
                        continue

                    # Extract real URL if it's a Google redirect
                    real_url = extract_real_url(sl_href) if sl_href else ""

                    if real_url and sl_text and sl_text.strip():
                        sitelinks.append({
                            "title": sl_text.strip(),
                            "link": real_url,
                        })
                except:
                    continue

            # Remove duplicates and limit to 6 sitelinks
            seen_titles = set()
            unique_sitelinks = []
            for sl in sitelinks:
                if sl["title"] not in seen_titles:
                    seen_titles.add(sl["title"])
                    unique_sitelinks.append(sl)
                    if len(unique_sitelinks) >= 6:
                        break

            if unique_sitelinks:
                ad_data["sitelinks"] = unique_sitelinks

        except:
            pass

        return ad_data

    except Exception as e:
        print(f"Error extracting ad data: {e}")
        return None


def extract_real_url(google_url: str) -> str:
    """Extract the real destination URL from a Google redirect URL."""
    if not google_url:
        return ""

    # If it's a Google ad click redirect, extract the actual URL
    if "google.com/aclk" in google_url:
        parsed = urlparse(google_url)
        params = parse_qs(parsed.query)
        # Try different parameter names that Google uses
        for param in ["adurl", "dest", "url"]:
            if param in params:
                return params[param][0]

    if "google.com/url" in google_url:
        parsed = urlparse(google_url)
        params = parse_qs(parsed.query)
        for param in ["url", "q"]:
            if param in params:
                return params[param][0]

    return google_url


async def capture_landing_screenshots(ads: list) -> list:
    """
    Capture full-page screenshots of landing pages for each ad.
    """
    if not ads:
        return ads

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )

        for ad in ads:
            landing_url = ad.get("link")
            if not landing_url:
                continue

            try:
                page = await context.new_page()

                # Navigate with timeout
                await page.goto(landing_url, timeout=20000, wait_until="domcontentloaded")

                # Wait for page to settle
                await asyncio.sleep(3)

                # Take full page screenshot
                screenshot = await page.screenshot(
                    type="jpeg",
                    quality=85,
                    full_page=True,
                )
                ad["landing_page_screenshot_base64"] = base64.b64encode(screenshot).decode()

                await page.close()

            except Exception as e:
                ad["landing_page_screenshot_base64"] = None
                ad["screenshot_error"] = str(e)

        await browser.close()

    return ads


if __name__ == "__main__":
    print(f"Starting AdSpy service v2.1.0 on {HOST}:{PORT}")
    print("Using Playwright with stealth mode for ad detection")
    uvicorn.run(app, host=HOST, port=PORT)
