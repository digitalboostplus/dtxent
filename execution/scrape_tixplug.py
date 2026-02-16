"""
scrape_tixplug.py — Fetch all events from tixplug.com via WordPress REST API.

Uses the public /wp-json/wp/v2/product endpoint (no auth needed).
Filters out sub-products (VIP seats, GA tickets, table options) by checking
for featured_media and product_cat.

Output: .tmp/tixplug_events.json
"""

import json
import os
import re
import sys
from datetime import datetime
from html import unescape
from pathlib import Path

import requests

# ---------- Configuration ----------
API_BASE = "https://tixplug.com/wp-json/wp/v2"
PRODUCTS_ENDPOINT = f"{API_BASE}/product"
MEDIA_ENDPOINT = f"{API_BASE}/media"
PER_PAGE = 100

# Category IDs to include (show=115, tixplug=126, festival=55, music=26)
# We include all and filter out uncategorized (20)
EXCLUDED_CATS = {20}  # uncategorized

OUTPUT_DIR = Path(__file__).resolve().parent.parent / ".tmp"


def strip_html(html_text: str) -> str:
    """Remove HTML tags and decode entities."""
    if not html_text:
        return ""
    clean = re.sub(r"<[^>]+>", "", html_text)
    clean = unescape(clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def parse_event_details(text: str) -> dict:
    """
    Extract date, location, doors open, and show start times from event text.

    TixPlug events typically have text like:
      Date: Friday, February 13th, 2026
      Location: Citrus Live – 108 N 12th Ave, Edinburg, TX 78539
      Doors Open: 7:30 PM
      Show Starts: 8:30 PM
    """
    details = {}

    # Date patterns
    date_match = re.search(
        r"Date:\s*([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})",
        text,
        re.IGNORECASE,
    )
    if date_match:
        details["date_raw"] = date_match.group(1).strip()

    # Also try inline date pattern like "Saturday, February 21st, 2026"
    if "date_raw" not in details:
        date_match2 = re.search(
            r"([A-Za-z]+day,?\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})",
            text,
            re.IGNORECASE,
        )
        if date_match2:
            details["date_raw"] = date_match2.group(1).strip()

    # Also try "Saturday, June 20, 2026" format
    if "date_raw" not in details:
        date_match3 = re.search(
            r"([A-Za-z]+day,?\s+[A-Za-z]+\s+\d{1,2},?\s*\d{4})",
            text,
            re.IGNORECASE,
        )
        if date_match3:
            details["date_raw"] = date_match3.group(1).strip()

    # Try without year: "Saturday, May 16th" (assume current year)
    if "date_raw" not in details:
        date_match4 = re.search(
            r"([A-Za-z]+day,?\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)",
            text,
            re.IGNORECASE,
        )
        if date_match4:
            current_year = datetime.now().year
            details["date_raw"] = f"{date_match4.group(1).strip()}, {current_year}"

    # Location / Venue
    loc_match = re.search(
        r"(?:Location|Venue):\s*(.+?)(?:Doors|Show|Event|Ticket|$)",
        text,
        re.IGNORECASE,
    )
    if loc_match:
        details["location_raw"] = loc_match.group(1).strip().rstrip("–—-").strip()

    # Doors Open
    doors_match = re.search(r"Doors\s*(?:Open)?:\s*(\d{1,2}:\d{2}\s*[APap][Mm])", text, re.IGNORECASE)
    if doors_match:
        details["doors_open"] = doors_match.group(1).strip()

    # Show Starts / Showtime
    show_match = re.search(
        r"(?:Show\s*(?:Starts)?|Showtime):\s*(\d{1,2}:\d{2}\s*[APap][Mm])",
        text,
        re.IGNORECASE,
    )
    if show_match:
        details["show_starts"] = show_match.group(1).strip()

    return details


def parse_date_to_iso(date_raw: str) -> str | None:
    """Convert a raw date string like 'Friday, February 13th, 2026' to ISO format."""
    if not date_raw:
        return None

    # Remove ordinal suffixes
    cleaned = re.sub(r"(\d+)(?:st|nd|rd|th)", r"\1", date_raw)
    # Remove day-of-week prefix
    cleaned = re.sub(r"^[A-Za-z]+,?\s*", "", cleaned)

    formats = [
        "%B %d, %Y",    # February 13, 2026
        "%B %d %Y",     # February 13 2026
        "%b %d, %Y",    # Feb 13, 2026
        "%b %d %Y",     # Feb 13 2026
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned.strip(), fmt)
            return dt.strftime("%Y-%m-%dT20:00:00")  # Default time 8 PM
        except ValueError:
            continue

    return None


def parse_venue_parts(location_raw: str) -> dict:
    """
    Parse venue string like 'Citrus Live – 108 N 12th Ave, Edinburg, TX 78539'
    into venue name, city, and state.
    """
    parts = {"venueName": "", "venueCity": "", "venueState": "TX"}

    if not location_raw:
        return parts

    # Fix concatenated venue names like "Cameron County AmphitheaterInside Isla Blanca Park"
    location_raw = re.sub(r"([a-z])([A-Z])", r"\1 – \2", location_raw)
    # Also handle "Inside" as a separator
    location_raw = re.sub(r"\s*Inside\s+", " – ", location_raw)

    # Split on dash/em-dash to get venue name and address
    venue_split = re.split(r"\s*[–—-]\s*", location_raw, maxsplit=1)
    parts["venueName"] = venue_split[0].strip()

    if len(venue_split) > 1:
        address = venue_split[1].strip()
        # Try to extract city and state from address
        # Pattern: "..., City, ST ZIP" or "..., City, ST"
        city_state_match = re.search(r",\s*([A-Za-z\s]+),\s*([A-Z]{2})\s*\d*", address)
        if city_state_match:
            parts["venueCity"] = city_state_match.group(1).strip()
            parts["venueState"] = city_state_match.group(2).strip()
        else:
            # Try simpler pattern: "City, ST"
            simple_match = re.search(r"([A-Za-z\s]+),\s*([A-Z]{2})", address)
            if simple_match:
                parts["venueCity"] = simple_match.group(1).strip()
                parts["venueState"] = simple_match.group(2).strip()

    return parts


def fetch_featured_image_url(media_id: int) -> str | None:
    """Fetch the image URL for a given media ID."""
    if not media_id or media_id == 0:
        return None

    try:
        resp = requests.get(f"{MEDIA_ENDPOINT}/{media_id}", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        # Prefer medium_large or large size, fallback to full
        sizes = data.get("media_details", {}).get("sizes", {})
        for size_key in ["medium_large", "large", "full"]:
            if size_key in sizes:
                return sizes[size_key].get("source_url")
        return data.get("source_url")
    except Exception as e:
        print(f"  [WARN] Could not fetch media {media_id}: {e}")
        return None


def fetch_all_products() -> list[dict]:
    """Fetch all products from the WP REST API with pagination."""
    all_products = []
    page = 1

    while True:
        print(f"  Fetching page {page}...")
        try:
            resp = requests.get(
                PRODUCTS_ENDPOINT,
                params={"per_page": PER_PAGE, "page": page},
                timeout=15,
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"  [ERROR] API request failed on page {page}: {e}")
            break

        products = resp.json()
        if not products:
            break

        all_products.extend(products)

        # Check if there are more pages
        total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
        if page >= total_pages:
            break
        page += 1

    print(f"  Fetched {len(all_products)} total products")
    return all_products


def process_product(product: dict) -> dict | None:
    """
    Process a single WP product into our event schema.
    Returns None if the product should be skipped (sub-product, etc).
    """
    product_id = product.get("id")
    title = strip_html(product.get("title", {}).get("rendered", ""))
    featured_media = product.get("featured_media", 0)
    product_cats = set(product.get("product_cat", []))
    slug = product.get("slug", "")
    link = product.get("link", "")

    # --- Filtering ---
    # Skip if no featured image (sub-products like "VIP Table Seat" don't have one)
    if not featured_media or featured_media == 0:
        print(f"  [SKIP] Skipping (no image): {title}")
        return None

    # Skip if only in uncategorized
    if product_cats and product_cats.issubset(EXCLUDED_CATS):
        print(f"  [SKIP] Skipping (uncategorized): {title}")
        return None

    print(f"  [OK] Processing: {title}")

    # Parse event details from excerpt (shorter, cleaner) and content (full details)
    excerpt_text = strip_html(product.get("excerpt", {}).get("rendered", ""))
    content_text = strip_html(product.get("content", {}).get("rendered", ""))
    combined_text = f"{excerpt_text} {content_text}"

    details = parse_event_details(combined_text)

    # Parse date
    event_date = parse_date_to_iso(details.get("date_raw"))
    if not event_date:
        # Fallback: use WP publish date
        wp_date = product.get("date", "")
        if wp_date:
            event_date = wp_date[:19]  # 2026-02-10T09:54:33

    # Parse venue
    venue = parse_venue_parts(details.get("location_raw", ""))

    # Parse artist name vs event name from title
    # Titles are like "Chingo's Love & Laughter Comedy Show" or
    # "Mötley KRÜE – A Tribute to Mötley Crue (RAILYARD 83)"
    # We'll use the full title as artistName and extract sub-title if present
    artist_name = title
    event_name = ""
    title_split = re.split(r"\s*[–—]\s*", title, maxsplit=1)
    if len(title_split) > 1:
        artist_name = title_split[0].strip()
        event_name = title_split[1].strip()

    # Fetch featured image URL
    image_url = fetch_featured_image_url(featured_media)

    # Generate a clean image filename from the slug
    image_name = ""
    if image_url:
        ext = image_url.rsplit(".", 1)[-1].split("?")[0] if "." in image_url else "jpg"
        image_name = f"{slug}.{ext}"

    # Build schedule from doors/show times
    schedule = []
    if details.get("doors_open"):
        schedule.append({"time": details["doors_open"], "description": "Doors Open"})
    if details.get("show_starts"):
        schedule.append({"time": details["show_starts"], "description": "Show Starts"})

    return {
        "artistName": artist_name,
        "eventName": event_name,
        "eventDate": event_date,
        "venueName": venue["venueName"],
        "venueCity": venue["venueCity"],
        "venueState": venue["venueState"],
        "imageName": image_name,
        "imageUrl": image_url,
        "ticketUrl": link,
        "isPublished": True,
        "source": "tixplug",
        "schedule": schedule if schedule else None,
    }


def main():
    print("=" * 60)
    print("TixPlug Event Scraper (WP REST API)")
    print("=" * 60)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Fetch all products
    products = fetch_all_products()

    # Process each product
    events = []
    for product in products:
        event = process_product(product)
        if event:
            events.append(event)

    # Sort by date
    events.sort(key=lambda e: e.get("eventDate") or "9999")

    # Save output
    output_path = OUTPUT_DIR / "tixplug_events.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"[OK] Saved {len(events)} events to {output_path}")
    print("=" * 60)

    # Print summary
    for e in events:
        print(f"  - {e['artistName']}: {e['eventName']} - {e['eventDate']}")

    return events


if __name__ == "__main__":
    main()
