"""
AdSpy Python Service v4.4
Uses Bright Data Browser API with Playwright to scrape Google sponsored ads.
Takes SERP screenshots and extracts ad data from rendered HTML.
Uses SerpApi Ads Transparency Center to get ad creative screenshots.
Now scrapes up to 5 pages and uses multiple ad selectors for more results.
"""

import asyncio
import base64
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from urllib.parse import quote_plus, urlparse

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright

# Configuration
ADSPY_API_KEY = os.environ.get("ADSPY_API_KEY", "adspy-dev-key")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))

# Bright Data Browser API WebSocket endpoint
BRIGHTDATA_BROWSER_WS = os.environ.get(
    "BRIGHTDATA_BROWSER_WS",
    "wss://brd-customer-hl_db89f492-zone-scraping_browser1:mk71movb50kw@brd.superproxy.io:9222"
)

# SerpApi key for Ads Transparency Center
SERPAPI_KEY = os.environ.get(
    "SERPAPI_KEY",
    "e7a0e6e506efcfaa3fd1d48d8166ee46578ea1dbb32951ef49553a2fbe0f6928"
)

# FastAPI app
app = FastAPI(title="AdSpy Service", version="4.4.2")

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
    source: str = "brightdata_browser"
    serp_screenshot: Optional[str] = None
    error: Optional[str] = None
    debug_info: Optional[dict] = None


@app.get("/health")
async def health_check():
    """Health check endpoint for Railway."""
    return {
        "status": "healthy",
        "service": "adspy",
        "version": "4.4.2",
        "timestamp": datetime.utcnow().isoformat(),
        "method": "browser_api_with_transparency_center",
        "max_pages": 5,
    }


@app.post("/search", response_model=SearchResponse)
async def search_ads(request: SearchRequest):
    """
    Search Google for sponsored ads using Bright Data Browser API.
    Returns extracted ad data and SERP screenshot.
    """
    # Validate API key
    if request.api_key != ADSPY_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    debug_info = {"method": "brightdata_browser_api", "version": "4.4.2"}

    try:
        result = await scrape_google_ads(
            keyword=request.keyword,
            location=request.location,
            num_results=request.num_results,
            debug_info=debug_info
        )

        return SearchResponse(
            success=True,
            keyword=request.keyword,
            ads=result["ads"],
            timestamp=datetime.utcnow().isoformat(),
            source="brightdata_browser",
            serp_screenshot=result.get("serp_screenshot"),
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
            source="brightdata_browser",
            error=str(e),
            debug_info=debug_info,
        )


async def scrape_google_ads(
    keyword: str,
    location: str = "us",
    num_results: int = 10,
    debug_info: dict = None,
    max_pages: int = 5  # Increased from 3 to 5 for more results
) -> Dict[str, Any]:
    """
    Connect to Bright Data Browser API and scrape Google ads from multiple pages.
    Uses multiple selectors and scrapes up to 5 pages for maximum ad coverage.
    """
    # Map location codes to Google parameters
    location_map = {
        "us": {"gl": "us", "hl": "en"},
        "uk": {"gl": "uk", "hl": "en"},
        "ca": {"gl": "ca", "hl": "en"},
        "au": {"gl": "au", "hl": "en"},
        "de": {"gl": "de", "hl": "de"},
        "fr": {"gl": "fr", "hl": "fr"},
        "es": {"gl": "es", "hl": "es"},
        "it": {"gl": "it", "hl": "it"},
        "br": {"gl": "br", "hl": "pt"},
        "mx": {"gl": "mx", "hl": "es"},
        "in": {"gl": "in", "hl": "en"},
        "jp": {"gl": "jp", "hl": "ja"},
    }

    loc = location_map.get(location, location_map["us"])
    encoded_keyword = quote_plus(keyword)

    ads = []
    serp_screenshots = []  # Store screenshots from each page
    seen_titles = set()  # Track seen ad titles to avoid duplicates
    seen_links = set()  # Also track by link to catch more duplicates
    consecutive_empty_pages = 0  # Track consecutive pages with no ads

    if debug_info:
        debug_info["pages_scraped"] = 0
        debug_info["ads_per_page"] = []
        debug_info["max_pages_configured"] = max_pages

    async with async_playwright() as p:
        # Connect to Bright Data Browser API with retry
        browser = None
        for connect_retry in range(3):
            try:
                browser = await p.chromium.connect_over_cdp(BRIGHTDATA_BROWSER_WS)
                break
            except Exception as conn_error:
                if debug_info:
                    debug_info[f"connection_retry_{connect_retry}"] = str(conn_error)[:100]
                if connect_retry < 2:
                    await asyncio.sleep(3)
                else:
                    raise

        try:
            page = await browser.new_page()

            for page_num in range(max_pages):
                # Add delay between pages to avoid Bright Data rate limiting
                if page_num > 0:
                    await asyncio.sleep(3)  # Wait between page navigations

                # Build URL with pagination (start parameter)
                start = page_num * 10
                search_url = f"https://www.google.com/search?q={encoded_keyword}&gl={loc['gl']}&hl={loc['hl']}&start={start}"

                if debug_info and page_num == 0:
                    debug_info["search_url"] = search_url

                # Navigate to Google search with retry for transient errors
                nav_success = False
                for retry in range(3):
                    try:
                        await page.goto(search_url, wait_until="domcontentloaded")
                        nav_success = True
                        break
                    except Exception as nav_error:
                        error_str = str(nav_error).lower()
                        # If we hit rate limiting, stop pagination but keep what we have
                        if "cooldown" in error_str or "no_peers" in error_str:
                            if debug_info:
                                debug_info["rate_limited_at_page"] = page_num + 1
                            break
                        # Retry on connection errors
                        if "tunnel" in error_str or "connection" in error_str or "timeout" in error_str:
                            if debug_info:
                                debug_info[f"retry_{page_num}_{retry}"] = str(nav_error)[:100]
                            await asyncio.sleep(2)  # Wait before retry
                            continue
                        raise

                if not nav_success:
                    if debug_info:
                        debug_info["navigation_failed_at_page"] = page_num + 1
                    break

                await asyncio.sleep(4)  # Wait for ads to load

                # Take SERP screenshot (only for first page)
                if page_num == 0:
                    screenshot_bytes = await page.screenshot(type="jpeg", quality=85, full_page=True)
                    serp_screenshots.append(base64.b64encode(screenshot_bytes).decode())
                    if debug_info:
                        debug_info["screenshot_size"] = len(serp_screenshots[0])

                page_ads_count = 0

                # Multiple selectors for different ad formats
                ad_selectors = [
                    '[data-text-ad="1"]',  # Standard text ads
                    '[data-hveid] div[data-dtld]',  # Some shopping/product ads
                    '#tads [data-hveid]',  # Top ads container items
                ]

                # Try each selector
                for selector in ad_selectors:
                    try:
                        ad_elements = await page.query_selector_all(selector)
                        for ad_el in ad_elements:
                            try:
                                ad_data = await extract_ad_data(ad_el, len(ads) + 1, page, block="top")
                                if ad_data and ad_data.get("title"):
                                    # Skip duplicates by title or link
                                    title = ad_data["title"]
                                    link = ad_data.get("link", "")
                                    if title not in seen_titles and link not in seen_links:
                                        seen_titles.add(title)
                                        if link:
                                            seen_links.add(link)
                                        ad_data["source_page"] = page_num + 1
                                        ads.append(ad_data)
                                        page_ads_count += 1
                            except Exception:
                                pass
                    except Exception:
                        pass

                # Also check for bottom ads (#tadsb)
                tadsb = await page.query_selector("#tadsb")
                if tadsb:
                    bottom_ads = await tadsb.query_selector_all('[data-text-ad="1"]')
                    for ad_el in bottom_ads:
                        try:
                            ad_data = await extract_ad_data(ad_el, len(ads) + 1, page, block="bottom")
                            if ad_data and ad_data.get("title"):
                                title = ad_data["title"]
                                link = ad_data.get("link", "")
                                if title not in seen_titles and link not in seen_links:
                                    seen_titles.add(title)
                                    if link:
                                        seen_links.add(link)
                                    ad_data["source_page"] = page_num + 1
                                    ads.append(ad_data)
                                    page_ads_count += 1
                        except Exception:
                            pass

                if debug_info:
                    debug_info["pages_scraped"] = page_num + 1
                    debug_info["ads_per_page"].append(page_ads_count)

                # Track consecutive empty pages - stop after 2 empty pages in a row
                if page_ads_count == 0:
                    consecutive_empty_pages += 1
                    if consecutive_empty_pages >= 2:
                        break
                else:
                    consecutive_empty_pages = 0

            if debug_info:
                debug_info["total_ads_extracted"] = len(ads)

        finally:
            await browser.close()

    # Use first page screenshot as main screenshot
    serp_screenshot = serp_screenshots[0] if serp_screenshots else None

    # Enrich ads with Transparency Center data (ad creative screenshots)
    ads = await enrich_ads_with_transparency_data(ads, debug_info)

    # Capture landing page screenshots using regular Playwright (not Bright Data)
    ads = await capture_landing_screenshots(ads, debug_info)

    return {"ads": ads, "serp_screenshot": serp_screenshot}


async def extract_ad_data(ad_el, position: int, page, block: str = "top") -> Dict[str, Any]:
    """Extract data from a single ad element."""
    ad_data = {
        "position": position,
        "block_position": block,
        "type": "sponsored_ad",
    }

    # Get title from role="heading" or first link
    title_el = await ad_el.query_selector('div[role="heading"]')
    if title_el:
        ad_data["title"] = await title_el.inner_text()
    else:
        first_link = await ad_el.query_selector('a')
        if first_link:
            text = await first_link.inner_text()
            if text and len(text) < 150:
                ad_data["title"] = text.strip()

    # Get displayed URL from cite
    cite = await ad_el.query_selector('cite')
    if cite:
        ad_data["displayed_link"] = await cite.inner_text()

    # Get destination link
    main_link = await ad_el.query_selector('a[data-rw]')
    if not main_link:
        main_link = await ad_el.query_selector('a')
    if main_link:
        href = await main_link.get_attribute('href')
        if href and not href.startswith('#'):
            ad_data["link"] = href

    # Get description - find longest text block
    all_text = await ad_el.inner_text()
    lines = [l.strip() for l in all_text.split('\n') if l.strip()]
    for line in lines:
        if len(line) > 50 and line != ad_data.get("title", ""):
            ad_data["description"] = line
            break

    # Get advertiser name
    spans = await ad_el.query_selector_all('span')
    for span in spans:
        text = await span.inner_text()
        if text and len(text) < 40 and '·' not in text and 'http' not in text.lower() and text != "Sponsored":
            if text != ad_data.get("title", "")[:40]:
                ad_data["advertiser"] = text.strip()
                break

    # Get sitelinks if present
    sitelinks = []
    sitelink_els = await ad_el.query_selector_all('a[data-impdclcc]')
    for sl in sitelink_els[:6]:
        sl_text = await sl.inner_text()
        sl_href = await sl.get_attribute('href')
        if sl_text and sl_href:
            sitelinks.append({"title": sl_text.strip(), "link": sl_href})
    if sitelinks:
        ad_data["sitelinks"] = sitelinks

    return ad_data


def extract_domain(url: str) -> Optional[str]:
    """Extract domain from URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        # Remove www. prefix
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return None


async def fetch_transparency_center_ads(domains: List[str], debug_info: dict = None) -> Dict[str, List[Dict]]:
    """
    Fetch ad creatives from Google Ads Transparency Center via SerpApi.
    Returns a dict mapping domain -> list of ad creatives.
    """
    results = {}
    unique_domains = list(set(d for d in domains if d))

    if debug_info:
        debug_info["transparency_domains_to_fetch"] = unique_domains

    async with httpx.AsyncClient(timeout=30.0) as client:
        for domain in unique_domains[:10]:  # Increased from 5 to 10 domains
            try:
                response = await client.get(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google_ads_transparency_center",
                        "text": domain,
                        "api_key": SERPAPI_KEY,
                    }
                )
                data = response.json()

                if "ad_creatives" in data:
                    creatives = data["ad_creatives"][:10]  # Limit to 10 creatives per domain
                    results[domain] = creatives
                    if debug_info:
                        debug_info[f"transparency_{domain}_count"] = len(creatives)
                else:
                    if debug_info:
                        debug_info[f"transparency_{domain}_error"] = data.get("error", "No ad_creatives")

            except Exception as e:
                if debug_info:
                    debug_info[f"transparency_{domain}_error"] = str(e)

    return results


async def enrich_ads_with_transparency_data(ads: list, debug_info: dict = None) -> list:
    """
    Enrich ads with data from Google Ads Transparency Center.
    Adds ad creative screenshots and additional metadata.
    """
    # Extract unique domains from ads
    domains = []
    for ad in ads:
        link = ad.get("link", "")
        displayed_link = ad.get("displayed_link", "")

        # Try to get domain from link first, then displayed_link
        domain = extract_domain(link)
        if not domain and displayed_link:
            domain = displayed_link.split("/")[0]
        if domain:
            domains.append(domain)
            ad["_domain"] = domain

    # Fetch transparency center data
    transparency_data = await fetch_transparency_center_ads(domains, debug_info)

    # Match ads with their transparency center creatives
    for ad in ads:
        domain = ad.pop("_domain", None)
        if domain and domain in transparency_data:
            creatives = transparency_data[domain]
            if creatives:
                # Add the first matching creative's image as the ad screenshot
                ad["ad_creative_image"] = creatives[0].get("image")
                ad["advertiser_id"] = creatives[0].get("advertiser_id")
                ad["advertiser_name"] = creatives[0].get("advertiser")

                # Add all creatives for this advertiser
                ad["all_creatives"] = [
                    {
                        "image": c.get("image"),
                        "format": c.get("format"),
                        "width": c.get("width"),
                        "height": c.get("height"),
                        "days_shown": c.get("total_days_shown"),
                    }
                    for c in creatives[:5]  # Limit to 5 creatives per ad
                ]

    return ads


async def capture_landing_screenshots(ads: list, debug_info: dict = None) -> list:
    """
    Capture full-page screenshots of landing pages for each ad.
    Uses regular Playwright (not Bright Data) to avoid robots.txt restrictions.
    """
    if not ads:
        return ads

    screenshots_captured = 0
    screenshots_failed = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )

        for ad in ads:
            landing_url = ad.get("link")
            if not landing_url or landing_url.startswith('/'):
                continue

            try:
                page = await context.new_page()

                # Navigate with timeout
                await page.goto(landing_url, timeout=20000, wait_until="domcontentloaded")

                # Wait for page to settle
                await asyncio.sleep(2)

                # Take full page screenshot
                screenshot = await page.screenshot(
                    type="jpeg",
                    quality=85,
                    full_page=True,
                )
                ad["landing_page_screenshot_base64"] = base64.b64encode(screenshot).decode()
                screenshots_captured += 1

                await page.close()

            except Exception as e:
                ad["landing_page_screenshot_base64"] = None
                ad["screenshot_error"] = str(e)
                screenshots_failed += 1

        await browser.close()

    if debug_info:
        debug_info["landing_screenshots_captured"] = screenshots_captured
        debug_info["landing_screenshots_failed"] = screenshots_failed

    return ads


if __name__ == "__main__":
    print(f"Starting AdSpy service v4.4.2 on {HOST}:{PORT}")
    print("Using Bright Data Browser API + Regular Playwright for landing pages")
    print("Scrapes up to 5 pages with multiple selectors for maximum ad coverage")
    uvicorn.run(app, host=HOST, port=PORT)
