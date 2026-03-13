"""
scrape_ticketmaster.py — Fetch upcoming events from the Ticketmaster Discovery API.

Replaces scrape_paynearena.py. Uses the official API instead of HTML scraping,
so it's reliable, proxy-friendly, and trivially extensible to new venues.

Configured venues (add new venue IDs here as DTXent expands):
  KovZpZAEdntA — Payne Arena, Hidalgo TX

Output: .tmp/ticketmaster_events.json

API docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
Rate limits: 5,000 calls/day, 5 req/sec (free tier)
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import requests

# ---------- Configuration ----------
SCRIPT_DIR = Path(__file__).resolve().parent
DTXENT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = DTXENT_DIR / ".tmp"
OUTPUT_FILE = OUTPUT_DIR / "ticketmaster_events.json"

TM_API_KEY = os.getenv("TM_API_KEY", "")
TM_BASE_URL = "https://app.ticketmaster.com/discovery/v2"

# Venues to fetch — add new entries here as DTXent expands
VENUES = [
    {
        "venueId": "KovZpZAEdntA",
        "venueName": "Payne Arena",
        "venueCity": "Hidalgo",
        "venueState": "TX",
    },
    # Example: add more venues here
    # {
    #     "venueId": "KovZpZAEAbntA",
    #     "venueName": "McAllen Convention Center",
    #     "venueCity": "McAllen",
    #     "venueState": "TX",
    # },
]


def load_api_key() -> str:
    """Load TM_API_KEY from env or .env file."""
    key = os.getenv("TM_API_KEY", "")
    if not key:
        env_file = DTXENT_DIR / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("TM_API_KEY="):
                    key = line.split("=", 1)[1].strip()
                    break
    return key


def slugify(text: str) -> str:
    """Convert text to a safe filename slug."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def pick_best_image(images: list[dict]) -> str:
    """Pick the best available event image URL (prefer 16_9 ratio, largest)."""
    if not images:
        return ""
    # Prefer ratio 16_9, then largest by width
    preferred = [i for i in images if i.get("ratio") == "16_9"]
    pool = preferred if preferred else images
    pool_sorted = sorted(pool, key=lambda i: i.get("width", 0), reverse=True)
    return pool_sorted[0].get("url", "") if pool_sorted else ""


def fetch_venue_events(venue: dict, api_key: str) -> list[dict]:
    """Fetch all upcoming events at a venue via the Discovery API."""
    events = []
    page = 0
    page_size = 50

    venue_id = venue["venueId"]
    venue_name = venue["venueName"]
    venue_city = venue["venueCity"]
    venue_state = venue["venueState"]

    print(f"  Fetching events for {venue_name} ({venue_id})...")

    while True:
        params = {
            "venueId": venue_id,
            "size": page_size,
            "page": page,
            "sort": "date,asc",
            "source": "ticketmaster",
        }
        headers = {"Authorization": f"apikey {api_key}"}

        try:
            resp = requests.get(
                f"{TM_BASE_URL}/events.json",
                params=params,
                headers=headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as e:
            print(f"    [ERROR] API request failed (page {page}): {e}")
            break

        embedded = data.get("_embedded", {})
        page_events = embedded.get("events", [])

        if not page_events:
            break

        for ev in page_events:
            # --- Dates ---
            dates_obj = ev.get("dates", {})
            start = dates_obj.get("start", {})
            date_time = start.get("dateTime")  # ISO 8601, e.g. "2026-03-12T01:00:00Z"
            local_date = start.get("localDate")  # "2026-03-12"
            local_time = start.get("localTime")  # "20:00:00"

            # Build eventDate in local time (no Z suffix — matches existing format)
            if local_date and local_time:
                event_date = f"{local_date}T{local_time}"
            elif local_date:
                event_date = f"{local_date}T20:00:00"
            else:
                event_date = date_time or ""

            # --- Artist/Attraction name ---
            attractions = ev.get("_embedded", {}).get("attractions", [])
            if attractions:
                artist_name = attractions[0].get("name", ev.get("name", ""))
            else:
                artist_name = ev.get("name", "")

            # --- Event name (sub-title / tour name) ---
            event_name = ev.get("name", "")
            # Remove artist name prefix if event name is just "Artist - Tour"
            if event_name.startswith(artist_name):
                event_name = event_name[len(artist_name):].lstrip(" -–:").strip()

            # --- Image ---
            image_url = pick_best_image(ev.get("images", []))
            image_name = ""
            if image_url:
                slug = slugify(artist_name)
                image_name = f"payne-{slug}.jpg"

            # --- Ticket URL ---
            ticket_url = ev.get("url", "")

            # --- Build event dict ---
            event = {
                "artistName": artist_name,
                "eventName": event_name,
                "eventDate": event_date,
                "venueName": venue_name,
                "venueCity": venue_city,
                "venueState": venue_state,
                "imageName": image_name,
                "imageUrl": image_url,
                "ticketUrl": ticket_url,
                "isPublished": True,
                "source": "ticketmaster",
                "tmEventId": ev.get("id", ""),
            }
            events.append(event)
            print(f"    [OK] {artist_name}: {event_name or '—'} — {local_date or 'TBD'}")

        # Pagination
        page_info = data.get("page", {})
        total_pages = page_info.get("totalPages", 1)
        if page >= total_pages - 1:
            break
        page += 1

    print(f"  Fetched {len(events)} events from {venue_name}")
    return events


def main():
    print("=" * 60)
    print("Ticketmaster Event Scraper (Discovery API)")
    print("=" * 60)

    # Load API key
    api_key = load_api_key()
    if not api_key:
        print("  [ERROR] TM_API_KEY not set. Add it to .env or set as environment variable.")
        print("  Get a free key at: https://developer.ticketmaster.com/")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Fetch events from all configured venues
    all_events = []
    for venue in VENUES:
        venue_events = fetch_venue_events(venue, api_key)
        all_events.extend(venue_events)

    # Sort by date
    all_events.sort(key=lambda e: e.get("eventDate") or "9999")

    # Save output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_events, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"[OK] Saved {len(all_events)} events to {OUTPUT_FILE}")
    print("=" * 60)

    return all_events


if __name__ == "__main__":
    main()
