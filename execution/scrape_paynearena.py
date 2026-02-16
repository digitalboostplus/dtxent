"""
scrape_paynearena.py — Scrape upcoming events from paynearena.com.

Payne Arena (Squarespace site) lists events as poster images with
Ticketmaster links. We extract:
- Artist name from the Ticketmaster URL slug
- Event date from the Ticketmaster URL slug
- Poster image from Squarespace CDN
- Ticket link (Ticketmaster URL)

Output: .tmp/paynearena_events.json
"""

import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ---------- Configuration ----------
URL = "https://paynearena.com"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / ".tmp"

# Known name corrections (Ticketmaster URLs mangle some names)
NAME_CORRECTIONS = {
    "Payne Arena Tickets": None,  # Skip - this is the venue page link
    "An Evening With Emerson Lake Palmer": "Emerson, Lake & Palmer",
    "Alejandro Sanz Y Ahora Que Gira": "Alejandro Sanz",
    "Carin Leon De Sonora Para El": "Carin León",
    "Los Angeles Azules Cumbia Sin Fronteras": "Los Angeles Azules",
    "Hidalgo Borderfest Manuel Turizo": "Manuel Turizo",
    "Grupo Bryndis Industria Del Amor Guardianes": "Grupo Bryndis, Industria Del Amor & Guardianes",
    "Reik Tour 2026": "Reik",
}

# Corresponding event sub-titles
EVENT_NAMES = {
    "Emerson, Lake & Palmer": "The United Tour",
    "Alejandro Sanz": "Y Ahora Que Gira",
    "Carin León": "De Sonora Para El Mundo Tour",
    "Los Angeles Azules": "Cumbia Sin Fronteras US Tour",
    "Manuel Turizo": "Borderfest 2026",
    "Grupo Bryndis, Industria Del Amor & Guardianes": "Romanticos Tour",
    "Reik": "Tour 2026",
    "Kodak Black": "Live in Concert",
    "Panter Belico": "Live in Concert",
    "Puppy Pals Live": "Live Show",
}


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


def extract_artist_from_tm_url(href: str) -> str | None:
    """Extract artist/event name from a Ticketmaster URL slug."""
    # Pattern: ticketmaster.com/artist-name-city-state-mm-dd-yyyy/event/...
    # or: ticketmaster.com/venue-tickets-city/venue/...
    match = re.search(
        r"ticketmaster\.com/(.+?)(?:-hidalgo|-mcallen|-edinburg|-texas)",
        href,
        re.IGNORECASE,
    )
    if match:
        raw = match.group(1).replace("-", " ").title()
        return raw
    return None


def extract_date_from_tm_url(href: str) -> str | None:
    """
    Extract event date from Ticketmaster URL.
    Pattern: ...texas-MM-DD-YYYY/event/...
    """
    match = re.search(r"texas-(\d{2})-(\d{2})-(\d{4})/", href)
    if match:
        month, day, year = match.groups()
        return f"{year}-{month}-{day}T20:00:00"
    return None


def parse_events(html: str) -> list[dict]:
    """Parse events from ticket links on the page."""
    soup = BeautifulSoup(html, "html.parser")
    events = []
    seen_hrefs = set()

    # Find all event cards
    cards = soup.find_all("article", class_="Index-gallery-item")
    print(f"  Found {len(cards)} event cards")

    for card in cards:
        # Find Ticketmaster links within this card
        links = card.find_all("a", href=re.compile(r"ticketmaster\.com", re.IGNORECASE))
        if not links:
            continue

        # Get the first Ticketmaster link (some cards have multiple pointing to the same event)
        href = links[0].get("href", "").split("?")[0]
        
        # Skip duplicate links across different cards
        if href in seen_hrefs:
            continue
        seen_hrefs.add(href)

        # Extract artist name from URL
        raw_name = extract_artist_from_tm_url(href)
        if not raw_name:
            continue

        # Apply name corrections
        if raw_name in NAME_CORRECTIONS:
            corrected = NAME_CORRECTIONS[raw_name]
            if corrected is None:
                continue
            artist_name = corrected
        else:
            artist_name = raw_name

        # Extract date from URL
        event_date = extract_date_from_tm_url(href)

        # Get image from the card (not just the link)
        img = card.find("img")
        image_url = ""
        if img:
            image_url = img.get("data-src") or img.get("src") or ""

        # Clean image filename
        image_name = ""
        if image_url:
            slug = re.sub(r"[^a-z0-9]+", "-", artist_name.lower()).strip("-")
            image_name = f"payne-{slug}.jpg"

        # Get event sub-title
        event_name = EVENT_NAMES.get(artist_name, "Live at Payne Arena")

        event = {
            "artistName": artist_name,
            "eventName": event_name,
            "eventDate": event_date,
            "venueName": "Payne Arena",
            "venueCity": "Hidalgo",
            "venueState": "TX",
            "imageName": image_name,
            "imageUrl": image_url,
            "ticketUrl": href,
            "isPublished": True,
            "source": "paynearena",
        }
        events.append(event)
        print(f"  [OK] {artist_name}: {event_name} - {event_date or 'TBD'}")

    return events


def main():
    print("=" * 60)
    print("Payne Arena Event Scraper (HTML)")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"  Fetching {URL}...")
    html = fetch_page(URL)
    print(f"  Received {len(html)} bytes\n")

    events = parse_events(html)

    # Sort by date
    events.sort(key=lambda e: e.get("eventDate") or "9999")

    # Save output
    output_path = OUTPUT_DIR / "paynearena_events.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"[OK] Saved {len(events)} events to {output_path}")
    print("=" * 60)

    return events


if __name__ == "__main__":
    main()
