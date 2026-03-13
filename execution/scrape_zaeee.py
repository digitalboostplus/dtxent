"""
scrape_zaeee.py — Scrape upcoming events from zaeee.saffire.com.

Z-94.5 (Z-AEEE) Tickets page typically lists pool parties and other events 
at South Padre Island venues.

Output: .tmp/zaeee_events.json
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ---------- Configuration ----------
URL = "https://zaeee.saffire.com/p/tickets"
SCRIPT_DIR = Path(__file__).resolve().parent
DTXENT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = DTXENT_DIR / ".tmp"
OUTPUT_FILE = OUTPUT_DIR / "zaeee_events.json"

def fetch_page(url: str) -> str:
    """Fetch page HTML."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.text

def parse_date(date_text: str) -> str | None:
    """
    Parse date from text like "FRIDAY, MARCH 20, 2026".
    Returns ISO format: YYYY-MM-DDT20:00:00
    """
    if not date_text:
        return None
    
    # Try to extract the date part
    # Pattern: [DAY], [MONTH] [DAY], [YEAR]
    match = re.search(r"([A-Z]+),\s+([A-Z]+)\s+(\d{1,2}),\s+(\d{4})", date_text, re.IGNORECASE)
    if match:
        day_of_week, month_name, day, year = match.groups()
        try:
            # Convert month name to number
            dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%dT20:00:00")
        except ValueError:
            pass
    
    return None

def parse_events(html: str) -> list[dict]:
    """Parse events from the tickets page."""
    soup = BeautifulSoup(html, "html.parser")
    events = []
    
    # Events are usually in modules with class 'modulePageTextMedia'
    modules = soup.find_all("div", class_="modulePageTextMedia")
    print(f"  Found {len(modules)} possible event modules")

    for mod in modules:
        # Title is in h2
        title_el = mod.find("h2")
        if not title_el:
            continue
        artist_name = title_el.text.strip()
        
        # Skip generic titles
        if artist_name.upper() in ["BUY TICKETS", "LOCATION", "PRICES ARE ALL IN", "TICKET OPTIONS"]:
            continue
            
        # Date is usually in a div/span inside the module
        event_date = None
        date_match = mod.find(text=re.compile(r"(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),", re.IGNORECASE))
        if date_match:
            event_date = parse_date(date_match.strip())
            
        # Image is in media-container
        image_url = ""
        img_el = mod.find("img", {"data-src": True}) or mod.find("img", {"src": True})
        if img_el:
            image_url = img_el.get("data-src") or img_el.get("src")
            # If it's relative, make it absolute (though Saffire usually uses full URLs for CDN)
            if image_url.startswith("/"):
                image_url = "https://zaeee.saffire.com" + image_url
        
        # Clean image filename
        image_name = ""
        if image_url:
            slug = re.sub(r"[^a-z0-9]+", "-", artist_name.lower()).strip("-")
            image_name = f"zaeee-{slug}.jpg"

        # Ticket URL
        # For this page, the ticket URL is often the page itself or a direct link in the module
        ticket_url = URL # Default to the current page
        buy_link = mod.find("a", class_=re.compile(r"buy|ticket|btn", re.IGNORECASE))
        if buy_link and buy_link.get("href"):
            ticket_url = buy_link.get("href")
            if ticket_url.startswith("/"):
                ticket_url = "https://zaeee.saffire.com" + ticket_url

        event = {
            "artistName": artist_name,
            "eventName": "Live at Peninsula Resort", # Usually these are at Peninsula
            "eventDate": event_date,
            "venueName": "Peninsula Island Resort",
            "venueCity": "South Padre Island",
            "venueState": "TX",
            "imageName": image_name,
            "imageUrl": image_url,
            "ticketUrl": ticket_url,
            "isPublished": True,
            "source": "zaeee",
        }
        
        # Special check: If we found a date, it's likely an event
        if event_date:
            events.append(event)
            print(f"  [OK] {artist_name} - {event_date[:10]}")
        else:
            # Sometimes events don't have dates in the text but are still events
            # For now, let's only include those with dates to avoid noise
            print(f"  [SKIP] {artist_name} (no date found)")

    return events

def main():
    print("=" * 60)
    print("Z-94.5 (ZAEEE) Event Scraper")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"  Fetching {URL}...")
    try:
        html = fetch_page(URL)
    except Exception as e:
        print(f"  [ERROR] Failed to fetch page: {e}")
        sys.exit(1)
        
    print(f"  Received {len(html)} bytes\n")

    events = parse_events(html)

    # Sort by date
    events.sort(key=lambda e: e.get("eventDate") or "9999")

    # Save output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"[OK] Saved {len(events)} events to {OUTPUT_FILE}")
    print("=" * 60)

    return events

if __name__ == "__main__":
    main()
