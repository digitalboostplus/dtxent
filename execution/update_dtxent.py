"""
update_dtxent.py — Merge scraped events and update the dtxent GitHub repo.

1. Runs scrape_tixplug.py to fetch events from tixplug.com
2. Runs scrape_paynearena.py to fetch events from paynearena.com
3. Merges, deduplicates, and sorts events
4. Downloads event poster images to assets/
5. Regenerates js/events-data.js with the LOCAL_EVENTS array
6. Commits and pushes changes to GitHub
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from datetime import datetime

import requests

# ---------- Configuration ----------
DTXENT_DIR = Path(__file__).resolve().parent.parent  # dtxent-site/
TMP_DIR = DTXENT_DIR / ".tmp"
ASSETS_DIR = DTXENT_DIR / "assets"
EVENTS_DATA_FILE = DTXENT_DIR / "js" / "events-data.js"


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


def load_scraped_events() -> tuple[list[dict], list[dict]]:
    """Run all scrapers and return merged events + per-source status.

    Returns:
        Tuple of (events list, sources_status list)
    """
    events = []
    sources_status = []

    # Source 1: TixPlug (WP REST API)
    tixplug_events, tixplug_status = run_scraper(
        "scrape_tixplug.py", "tixplug_events.json", "https://tixplug.com"
    )
    events.extend(tixplug_events)
    sources_status.append(tixplug_status)

    # Source 2: Payne Arena (HTML scraper)
    payne_events, payne_status = run_scraper(
        "scrape_paynearena.py", "paynearena_events.json", "https://paynearena.com"
    )
    events.extend(payne_events)
    sources_status.append(payne_status)

    return events, sources_status


def deduplicate_events(events: list[dict]) -> list[dict]:
    """Remove duplicate events and group multi-date shows into single entries."""
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
            # Single date event - keep as-is
            final.append(group_events[0])
        else:
            # Multi-date show - consolidate into one entry with dates array
            # Sort by date
            group_events.sort(key=lambda e: e.get("eventDate") or "9999")

            # Use first event as base, add dates array
            base = group_events[0].copy()
            base["dates"] = []
            for evt in group_events:
                base["dates"].append({
                    "eventDate": evt.get("eventDate"),
                    "ticketUrl": evt.get("ticketUrl")
                })

            # Keep the first date as primary eventDate (for sorting)
            # ticketUrl will be the first date's URL (fallback)
            print(f"  [INFO] Grouped {len(group_events)} dates for: {base.get('artistName')}")
            final.append(base)

    removed = len(events) - len(final)
    if removed > 0:
        print(f"  Consolidated {removed} events into multi-date shows")

    return final


def download_image(image_url: str, filename: str) -> bool:
    """Download an event image to the assets directory."""
    if not image_url or not filename:
        return False

    dest = ASSETS_DIR / filename
    if dest.exists():
        print(f"    Image already exists: {filename}")
        return True

    try:
        resp = requests.get(image_url, timeout=15, stream=True)
        resp.raise_for_status()

        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"    [OK] Downloaded: {filename}")
        return True
    except Exception as e:
        print(f"    [ERROR] Failed to download {filename}: {e}")
        return False


def generate_events_data_js(events: list[dict]) -> str:
    """Generate the events-data.js file content."""

    # Build the LOCAL_EVENTS entries
    event_entries = []
    for event in events:
        entry_lines = []
        entry_lines.append(f'        artistName: {json.dumps(event.get("artistName", ""), ensure_ascii=False)},')
        entry_lines.append(f'        eventName: {json.dumps(event.get("eventName", ""), ensure_ascii=False)},')
        entry_lines.append(f'        eventDate: {json.dumps(event.get("eventDate", ""), ensure_ascii=False)},')
        entry_lines.append(f'        venueName: {json.dumps(event.get("venueName", ""), ensure_ascii=False)},')
        entry_lines.append(f'        venueCity: {json.dumps(event.get("venueCity", ""), ensure_ascii=False)},')
        entry_lines.append(f'        venueState: {json.dumps(event.get("venueState", "TX"), ensure_ascii=False)},')
        entry_lines.append(f'        imageName: {json.dumps(event.get("imageName", ""), ensure_ascii=False)},')
        entry_lines.append(f'        ticketUrl: {json.dumps(event.get("ticketUrl", ""), ensure_ascii=False)},')

        # Include schedule if present
        schedule = event.get("schedule")
        if schedule:
            schedule_items = []
            for item in schedule:
                schedule_items.append(
                    f'            {{ time: {json.dumps(item["time"])}, description: {json.dumps(item["description"])} }}'
                )
            entry_lines.append(f'        schedule: [\n' + ",\n".join(schedule_items) + "\n        ],")

        # Include dates array for multi-date shows
        dates = event.get("dates")
        if dates and len(dates) > 1:
            date_items = []
            for d in dates:
                date_items.append(
                    f'            {{ eventDate: {json.dumps(d["eventDate"])}, ticketUrl: {json.dumps(d["ticketUrl"])} }}'
                )
            entry_lines.append(f'        dates: [\n' + ",\n".join(date_items) + "\n        ],")

        entry_lines.append(f'        isPublished: true')

        event_entries.append("    {\n" + "\n".join(entry_lines) + "\n    }")

    events_array = ",\n".join(event_entries)

    # Read existing file to preserve LOCAL_CLUBS, LOCAL_RESTAURANTS, LOCAL_HOTELS
    existing_extras = ""
    if EVENTS_DATA_FILE.exists():
        with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract everything after LOCAL_EVENTS closing bracket
        # Find where LOCAL_CLUBS starts
        clubs_match = re.search(r"(export const LOCAL_CLUBS\s*=)", content)
        if clubs_match:
            existing_extras = "\n" + content[clubs_match.start():]

    js_content = f"""/**
 * Events data - Auto-generated by update_dtxent workflow
 * Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
 * Sources: tixplug.com, paynearena.com
 */
export const LOCAL_EVENTS = [
{events_array}
];
{existing_extras}"""

    return js_content


def git_operations():
    """Stage, commit, and push changes to GitHub."""
    print("\n  Running git operations...")

    try:
        # Pull latest first
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "pull", "--rebase"],
            check=True,
            capture_output=True,
            text=True,
        )
        print("    [OK] Pulled latest changes")

        # Stage events-data.js
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "add", "js/events-data.js"],
            check=True,
            capture_output=True,
            text=True,
        )
        # Stage assets directory
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "add", "assets/"],
            check=True,
            capture_output=True,
            text=True,
        )
        print("    [OK] Staged changes")

        # Check if there are changes to commit
        result = subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "diff", "--cached", "--name-only"],
            capture_output=True,
            text=True,
        )

        if not result.stdout.strip():
            print("    [INFO] No changes to commit")
            return

        # Commit
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        commit_msg = f"chore: update events data from tixplug + paynearena ({timestamp})"
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "commit", "-m", commit_msg],
            check=True,
            capture_output=True,
            text=True,
        )
        print(f"    [OK] Committed: {commit_msg}")

        # Push
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "push"],
            check=True,
            capture_output=True,
            text=True,
        )
        print("    [OK] Pushed to GitHub")

    except subprocess.CalledProcessError as e:
        print(f"    [ERROR] Git error: {e}")
        if e.stderr:
            print(f"      stderr: {e.stderr}")
        print("    [INFO] You may need to push manually: git -C dtxent-site/ push")


def main():
    print("=" * 60)
    print("DTXent Website Updater")
    print("=" * 60)

    # Verify dtxent-site exists
    if not DTXENT_DIR.exists():
        print(f"  [ERROR] dtxent-site directory not found at {DTXENT_DIR}")
        print("  Run: git clone https://github.com/digitalboostplus/dtxent.git dtxent-site")
        sys.exit(1)

    # Load scraped events
    print("\n1. Loading scraped events...")
    events, sources_status = load_scraped_events()

    if not events:
        print("  [ERROR] No events found from either scraper. Check your network connection.")
        sys.exit(1)

    # Deduplicate
    print("\n2. Deduplicating...")
    events = deduplicate_events(events)

    # Sort by date
    events.sort(key=lambda e: e.get("eventDate") or "9999")
    
    # Filter out past events (older than 6 hours ago)
    now = datetime.now()
    cutoff_time = now.timestamp() - (6 * 60 * 60)
    
    upcoming_events = []
    for e in events:
        event_date_str = e.get("eventDate")
        if not event_date_str:
            upcoming_events.append(e) # Keep events with no date for manual review? Or skip?
            continue
            
        try:
            # Format is 2026-02-07T20:00:00
            event_dt = datetime.fromisoformat(event_date_str)
            if event_dt.timestamp() >= cutoff_time:
                upcoming_events.append(e)
        except ValueError:
            print(f"  [WARN] Invalid date format for {e.get('artistName')}: {event_date_str}")
            upcoming_events.append(e)

    events = upcoming_events
    print(f"  {len(events)} unique upcoming events, sorted by date")

    # Download images
    print("\n3. Downloading event images...")
    for event in events:
        image_url = event.get("imageUrl")
        image_name = event.get("imageName")
        if image_url and image_name:
            download_image(image_url, image_name)

    # Generate events-data.js
    print("\n4. Generating events-data.js...")
    js_content = generate_events_data_js(events)
    with open(EVENTS_DATA_FILE, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  [OK] Written to {EVENTS_DATA_FILE}")

    # Git operations
    print("\n5. Pushing to GitHub...")
    git_operations()

    # Firestore sync
    print("\n6. Syncing to Firestore...")
    sync_stats = {"created": 0, "updated": 0, "errors": 0}
    try:
        from sync_firestore import sync_events_to_firestore, mark_closed_events, write_scrape_log
        sync_stats = sync_events_to_firestore(events)
        mark_closed_events()
        print("  [OK] Firestore sync complete")

        # Write scrape log
        print("\n7. Writing scrape log...")
        write_scrape_log(sources_status, events, sync_stats)
    except ImportError as e:
        print(f"  [WARN] Firestore sync skipped (firebase-admin not installed): {e}")
    except FileNotFoundError as e:
        print(f"  [WARN] Firestore sync skipped (service account not found): {e}")
    except Exception as e:
        print(f"  [WARN] Firestore sync failed: {e}")

    print(f"\n{'=' * 60}")
    print(f"[OK] Done! Updated {len(events)} events on dtxent.com")
    print("=" * 60)

    # Summary grouped by source
    for src_label in ["tixplug", "paynearena"]:
        src_events = [e for e in events if e.get("source", "") == src_label]
        if src_events:
            print(f"\n  [{src_label}] {len(src_events)} events:")
            for e in src_events:
                print(f"    • {e['artistName']}: {e.get('eventName', '') or '—'} — {e.get('eventDate', 'TBD')[:10]}")


if __name__ == "__main__":
    main()
