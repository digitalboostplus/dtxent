"""
1. Runs scrape_tixplug.py to fetch events from tixplug.com
2. Runs scrape_paynearena.py to fetch events from paynearena.com
3. Runs scrape_zaeee.py to fetch events from zaeee.saffire.com
4. Merges, deduplicates, and sorts events
5. Downloads event poster images to assets/
6. Regenerates js/events-data.js with the LOCAL_EVENTS array
7. Syncs events to Firestore (for admin dashboard functionality)
8. Commits and推送 changes to GitHub
"""

import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from datetime import datetime

import requests

# ---------- Configuration ----------
DTXENT_DIR = Path(__file__).resolve().parent.parent  # dtxent-site/
TMP_DIR = DTXENT_DIR / ".tmp"
ASSETS_DIR = DTXENT_DIR / "assets"
EVENTS_DATA_FILE = DTXENT_DIR / "js" / "events-data.js"

# Artists to exclude (case-insensitive substring match)
EXCLUDE_ARTISTS = [
    "Los Angeles Lakers",
    "Alex Warren",
    "Tacos, Tequilas",
    "Snow Tha Product"
]


def run_scraper(scraper_name: str, output_filename: str, source_url: str) -> tuple[list[dict], dict]:
    """Run a scraper script and load its output JSON."""
    scraper = Path(__file__).resolve().parent / scraper_name
    try:
        result = subprocess.run(
            [sys.executable, str(scraper)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr or "non-zero exit")
        print(result.stdout.rstrip())
    except Exception as e:
        print(f"  [WARN] {scraper_name} failed: {e}")
        return [], {
            "name": scraper_name.replace(".py", ""),
            "url": source_url,
            "eventsFound": 0,
            "status": "error",
            "errorMessage": str(e),
        }

    out_path = TMP_DIR / output_filename
    if out_path.exists():
        with open(out_path, "r", encoding="utf-8") as f:
            events = json.load(f)
        return events, {
            "name": scraper_name.replace(".py", ""),
            "url": source_url,
            "eventsFound": len(events),
            "status": "success",
            "errorMessage": None,
        }
    return [], {
        "name": scraper_name.replace(".py", ""),
        "url": source_url,
        "eventsFound": 0,
        "status": "skipped",
        "errorMessage": f"{output_filename} not found after scrape",
    }


def run_paynearena_scraper() -> tuple[list[dict], dict]:
    """Run scrape_paynearena.py and return events + status."""
    return run_scraper(
        "scrape_paynearena.py", 
        "paynearena_events.json", 
        "https://paynearena.com"
    )


def run_tixplug_scraper() -> tuple[list[dict], dict]:
    """Run scrape_tixplug.py and return events + status."""
    return run_scraper(
        "scrape_tixplug.py", 
        "tixplug_events.json", 
        "https://tixplug.com"
    )


def run_zaeee_scraper() -> tuple[list[dict], dict]:
    """Run scrape_zaeee.py and return events + status."""
    return run_scraper(
        "scrape_zaeee.py", 
        "zaeee_events.json", 
        "https://zaeee.saffire.com/p/tickets"
    )


def load_manual_events() -> tuple[list[dict], dict]:
    """Load manually curated events (TixPlug / custom venues)."""
    manual_path = Path(__file__).resolve().parent / "manual_events.json"
    if not manual_path.exists():
        print("  [INFO] No manual_events.json found — skipping")
        return [], {
            "name": "manual",
            "url": "manual_events.json",
            "eventsFound": 0,
            "status": "skipped",
            "errorMessage": "manual_events.json not found",
        }

    with open(manual_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # Strip comment entries and unpublished events
    events = [
        {**e, "source": e.get("source", "manual")}
        for e in raw
        if not e.get("_comment") and e.get("isPublished", True)
    ]
    print(f"  Loaded {len(events)} manual events")
    return events, {
        "name": "manual",
        "url": "manual_events.json",
        "eventsFound": len(events),
        "status": "success",
        "errorMessage": None,
    }


def load_scraped_events() -> tuple[list[dict], list[dict]]:
    """Run all scrapers and return merged events + per-source status."""
    events = []
    sources_status = []

    # Source 1: Payne Arena (HTML Scraping)
    payne_events, payne_status = run_paynearena_scraper()
    events.extend(payne_events)
    sources_status.append(payne_status)

    # Source 2: TixPlug (WordPress API)
    tixplug_events, tixplug_status = run_tixplug_scraper()
    events.extend(tixplug_events)
    sources_status.append(tixplug_status)

    # Source 3: Z-94.5 (Saffire)
    zaeee_events, zaeee_status = run_zaeee_scraper()
    events.extend(zaeee_events)
    sources_status.append(zaeee_status)

    # Source 4: Manual events file (if any)
    manual_events, manual_status = load_manual_events()
    events.extend(manual_events)
    sources_status.append(manual_status)

    return events, sources_status


def deduplicate_events(events: list[dict]) -> list[dict]:
    """Remove duplicate events and group multi-date shows into single entries."""
    # Pass 0: merge same-artist+date pairs where one entry has empty venue
    # This handles the case where a scraper fetches an event without venue info
    # and a manual entry exists for the same event with venue filled in.
    by_artist_date = defaultdict(list)
    for event in events:
        artist = re.sub(r"[^a-z0-9]", "", event.get("artistName", "").lower())
        date = event.get("eventDate", "")[:10]
        by_artist_date[f"{artist}_{date}"].append(event)

    pre_merged = []
    for group in by_artist_date.values():
        if len(group) == 1:
            pre_merged.append(group[0])
            continue
        empty_venue = [e for e in group if not e.get("venueName", "").strip()]
        with_venue = [e for e in group if e.get("venueName", "").strip()]
        if empty_venue and with_venue:
            base = with_venue[0].copy()
            donor = empty_venue[0]
            for field in ("imageUrl", "schedule", "eventName", "imageName"):
                if not base.get(field) and donor.get(field):
                    base[field] = donor[field]
            pre_merged.append(base)
            pre_merged.extend(with_venue[1:])
            print(f"  [INFO] Merged empty-venue duplicate: {base.get('artistName')}")
        else:
            pre_merged.extend(group)
    events = pre_merged

    # First pass: exact duplicates (same artist + date + venue)
    seen_exact = {}
    unique = []

    for event in events:
        artist = re.sub(r"[^a-z0-9]", "", event.get("artistName", "").lower())
        date = event.get("eventDate", "")[:10]  # YYYY-MM-DD only
        venue = re.sub(r"[^a-z0-9]", "", event.get("venueName", "").lower())
        key = f"{artist}_{date}_{venue}"

        if key and key not in seen_exact:
            seen_exact[key] = True
            unique.append(event)
        elif not key:
            unique.append(event)

    # Second pass: group multi-date shows (same artist + venue, different dates)
    grouped = {}
    for event in unique:
        artist = re.sub(r"[^a-z0-9]", "", event.get("artistName", "").lower())
        venue = re.sub(r"[^a-z0-9]", "", event.get("venueName", "").lower())
        group_key = f"{artist}_{venue}"

        if group_key not in grouped:
            grouped[group_key] = []
        grouped[group_key].append(event)

    # Build final list, consolidating multi-date shows
    final = []
    for group_key, group_events in grouped.items():
        if len(group_events) == 1:
            final.append(group_events[0])
        else:
            group_events.sort(key=lambda e: e.get("eventDate") or "9999")
            base = group_events[0].copy()
            base["dates"] = []
            for evt in group_events:
                base["dates"].append({
                    "eventDate": evt.get("eventDate"),
                    "ticketUrl": evt.get("ticketUrl")
                })
            print(f"  [INFO] Grouped {len(group_events)} dates for: {base.get('artistName')}")
            final.append(base)

    removed = len(events) - len(final)
    if removed > 0:
        print(f"  Consolidated {removed} events total")

    return final


def download_image(image_url: str, filename: str) -> bool:
    """Download image to assets folder."""
    if not image_url:
        return False
    
    target_path = ASSETS_DIR / filename
    if target_path.exists():
        return False  # Already have it
        
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(image_url, headers=headers, stream=True, timeout=10)
        resp.raise_for_status()
        with open(target_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"  [WARN] Failed to download {image_url}: {e}")
        return False


def generate_events_data_js(events: list[dict]):
    """Update js/events-data.js with the new events list."""
    if not EVENTS_DATA_FILE.exists():
        print(f"  [ERROR] {EVENTS_DATA_FILE} not found")
        return

    with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    # Create the JS array content
    events_json = json.dumps(events, indent=4, ensure_ascii=False)
    # Remove the surrounding brackets for the variable string injection
    # Actually, we keep them because it's a full array
    
    pattern = r"const LOCAL_EVENTS = \[.*?\];"
    replacement = f"const LOCAL_EVENTS = {events_json};"
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Update timestamp
    timestamp_pattern = r"// Last updated: .*"
    timestamp_replacement = f"// Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    new_content = re.sub(timestamp_pattern, timestamp_replacement, new_content)

    # Update sources
    sources_pattern = r" \* Sources: .*"
    sources_replacement = " * Sources: paynearena.com, tixplug.com, zaeee.saffire.com"
    new_content = re.sub(sources_pattern, sources_replacement, new_content)

    with open(EVENTS_DATA_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)


def git_operations():
    """Commit and push changes to GitHub."""
    print("\n3. Running git operations...")
    try:
        # Check for remote changes first
        subprocess.run(["git", "fetch", "origin"], check=True)
        
        # Add changed files
        subprocess.run(["git", "add", "js/events-data.js", "assets/"], check=True)
        subprocess.run(["git", "add", "execution/"], check=True)
        
        # Check if there are changes to commit
        status = subprocess.run(["git", "diff", "--cached", "--quiet"])
        if status.returncode == 0:
            print("  No changes to commit.")
            return

        # Commit
        msg = f"chore: update events data ({datetime.now().strftime('%Y-%m-%d')})"
        subprocess.run(["git", "commit", "-m", msg], check=True)
        
        # Push with rebase to handle remote changes
        subprocess.run(["git", "pull", "--rebase", "origin", "main"], check=True)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print("  [OK] Changes pushed successfully")

    except subprocess.CalledProcessError as e:
        print(f"  [WARN] Git operations failed: {e}")


def sync_to_firestore(events: list[dict]):
    """Sync events to Firestore (for admin dashboard)."""
    print("\n4. Syncing to Firestore...")
    try:
        # Import sync_firestore locally to avoid dependency issues if not installed
        import sys
        sys.path.append(str(DTXENT_DIR / "execution"))
        from sync_firestore import sync_events_to_firestore
        
        sync_events_to_firestore(events)
        print("  [OK] Firestore sync complete")
    except Exception as e:
        print(f"  [WARN] Firestore sync failed: {e}")


def main():
    print("=" * 60)
    print("DTXent Website Updater")
    print("=" * 60)

    # 1. Load Events
    print("\n1. Loading scraped events...")
    all_events, sources_status = load_scraped_events()

    if not all_events:
        print("  [ERROR] No events found from any source.")
        return

    # 2. Process Events
    print(f"\n2. Processing {len(all_events)} events...")
    
    # Filter out excluded artists
    filtered_events = []
    for e in all_events:
        artist = e.get("artistName", "")
        if any(ex.lower() in artist.lower() for ex in EXCLUDE_ARTISTS):
            continue
        filtered_events.append(e)
    
    if len(all_events) > len(filtered_events):
        print(f"  Excluded {len(all_events) - len(filtered_events)} events based on EXCLUDE_ARTISTS list")

    # Remove past events
    now_str = datetime.now().strftime("%Y-%m-%d")
    current_events = [e for e in filtered_events if (e.get("eventDate") or "0000") >= now_str]
    print(f"  Removed {len(filtered_events) - len(current_events)} past events")
    
    # Deduplicate and group
    processed_events = deduplicate_events(current_events)
    
    # Sort by date
    processed_events.sort(key=lambda e: e.get("eventDate") or "9999")

    # Image Downloads
    print("\n3. Downloading event images...")
    new_images = 0
    for event in processed_events:
        if event.get("imageUrl") and event.get("imageName"):
            if download_image(event["imageUrl"], event["imageName"]):
                new_images += 1
    print(f"  Downloaded {new_images} new images")

    # Update JS Data File
    print("\n4. Updating website data file...")
    generate_events_data_js(processed_events)
    print(f"  [OK] Updated {EVENTS_DATA_FILE}")

    # Firestore Sync
    sync_to_firestore(processed_events)

    # Git Operations
    git_operations()

    print("\n" + "=" * 60)
    print(f"[OK] Done! Updated {len(processed_events)} events on dtxent.com")
    print("=" * 60)

    # Summary grouped by source
    for src_label in ["paynearena", "tixplug", "zaeee", "manual"]:
        src_events = [e for e in all_events if e.get("source", "manual") == src_label]
        if src_events:
            print(f"\n  [{src_label.upper()}] {len(src_events)} events:")
            for e in src_events:
                print(f"    • {e['artistName']}: {e.get('eventName', '') or '—'} — {e.get('eventDate', 'TBD')[:10]}")


if __name__ == "__main__":
    main()
