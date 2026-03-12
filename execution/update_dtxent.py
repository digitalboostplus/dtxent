"""
update_dtxent.py — Merge scraped events and update the dtxent GitHub repo.

1. Runs scrape_ticketmaster.py to fetch events from the Ticketmaster Discovery API
2. Loads manual_events.json for TixPlug / custom events
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


def run_ticketmaster_scraper() -> tuple[list[dict], dict]:
    """Run scrape_ticketmaster.py and return events + status."""
    scraper = Path(__file__).resolve().parent / "scrape_ticketmaster.py"
    try:
        result = subprocess.run(
            [sys.executable, str(scraper)],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr or "non-zero exit")
        print(result.stdout.rstrip())
    except Exception as e:
        print(f"  [WARN] Ticketmaster scraper failed: {e}")
        return [], {
            "name": "ticketmaster",
            "url": "https://app.ticketmaster.com",
            "eventsFound": 0,
            "status": "error",
            "errorMessage": str(e),
        }

    tm_path = TMP_DIR / "ticketmaster_events.json"
    if tm_path.exists():
        with open(tm_path, "r", encoding="utf-8") as f:
            events = json.load(f)
        return events, {
            "name": "ticketmaster",
            "url": "https://app.ticketmaster.com",
            "eventsFound": len(events),
            "status": "success",
            "errorMessage": None,
        }
    return [], {
        "name": "ticketmaster",
        "url": "https://app.ticketmaster.com",
        "eventsFound": 0,
        "status": "skipped",
        "errorMessage": "ticketmaster_events.json not found after scrape",
    }


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
    """Fetch and load events from all sources.

    Returns:
        Tuple of (events list, sources_status list)
    """
    events = []
    sources_status = []

    # Source 1: Ticketmaster Discovery API (replaces scrape_paynearena.py)
    tm_events, tm_status = run_ticketmaster_scraper()
    events.extend(tm_events)
    sources_status.append(tm_status)

    # Source 2: Manual events file (replaces scrape_tixplug.py)
    manual_events, manual_status = load_manual_events()
    events.extend(manual_events)
    sources_status.append(manual_status)

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

        schedule = event.get("schedule")
        if schedule:
            schedule_items = [
                f'            {{ time: {json.dumps(item["time"])}, description: {json.dumps(item["description"])} }}'
                for item in schedule
            ]
            entry_lines.append('        schedule: [\n' + ",\n".join(schedule_items) + "\n        ],")

        dates = event.get("dates")
        if dates and len(dates) > 1:
            date_items = [
                f'            {{ eventDate: {json.dumps(d["eventDate"])}, ticketUrl: {json.dumps(d["ticketUrl"])} }}'
                for d in dates
            ]
            entry_lines.append('        dates: [\n' + ",\n".join(date_items) + "\n        ],")

        entry_lines.append('        isPublished: true')
        event_entries.append("    {\n" + "\n".join(entry_lines) + "\n    }")

    events_array = ",\n".join(event_entries)

    existing_extras = ""
    if EVENTS_DATA_FILE.exists():
        with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        clubs_match = re.search(r"(export const LOCAL_CLUBS\s*=)", content)
        if clubs_match:
            existing_extras = "\n" + content[clubs_match.start():]

    return f"""/**
 * Events data - Auto-generated by update_dtxent workflow
 * Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
 * Sources: Ticketmaster Discovery API, manual_events.json
 */
export const LOCAL_EVENTS = [
{events_array}
];
{existing_extras}"""


def git_operations():
    """Stage, commit, and push changes to GitHub."""
    print("\n  Running git operations...")
    try:
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "pull", "--rebase"],
            check=True, capture_output=True, text=True,
        )
        print("    [OK] Pulled latest changes")
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "add", "js/events-data.js"],
            check=True, capture_output=True, text=True,
        )
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "add", "assets/"],
            check=True, capture_output=True, text=True,
        )
        print("    [OK] Staged changes")

        result = subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "diff", "--cached", "--name-only"],
            capture_output=True, text=True,
        )
        if not result.stdout.strip():
            print("    [INFO] No changes to commit")
            return

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        commit_msg = f"chore: update events data from Ticketmaster + manual ({timestamp})"
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "commit", "-m", commit_msg],
            check=True, capture_output=True, text=True,
        )
        print(f"    [OK] Committed: {commit_msg}")
        subprocess.run(
            ["git", "-C", str(DTXENT_DIR), "push"],
            check=True, capture_output=True, text=True,
        )
        print("    [OK] Pushed to GitHub")

    except subprocess.CalledProcessError as e:
        print(f"    [ERROR] Git error: {e}")
        if e.stderr:
            print(f"      stderr: {e.stderr}")
        print("    [INFO] You may need to push manually: git -C dtxent/ push")


def main():
    print("=" * 60)
    print("DTXent Website Updater")
    print("=" * 60)

    if not DTXENT_DIR.exists():
        print(f"  [ERROR] dtxent directory not found at {DTXENT_DIR}")
        sys.exit(1)

    print("\n1. Loading events...")
    events, sources_status = load_scraped_events()

    if not events:
        print("  [ERROR] No events found. Check Ticketmaster API key and manual_events.json.")
        sys.exit(1)

    print("\n2. Deduplicating...")
    events = deduplicate_events(events)
    events.sort(key=lambda e: e.get("eventDate") or "9999")

    # Filter out past events (older than 6 hours ago)
    now = datetime.now()
    cutoff_time = now.timestamp() - (6 * 60 * 60)
    upcoming_events = []
    for e in events:
        event_date_str = e.get("eventDate")
        if not event_date_str:
            upcoming_events.append(e)
            continue
        try:
            event_dt = datetime.fromisoformat(event_date_str)
            if event_dt.timestamp() >= cutoff_time:
                upcoming_events.append(e)
        except ValueError:
            print(f"  [WARN] Invalid date format for {e.get('artistName')}: {event_date_str}")
            upcoming_events.append(e)

    events = upcoming_events
    print(f"  {len(events)} unique upcoming events, sorted by date")

    print("\n3. Downloading event images...")
    for event in events:
        image_url = event.get("imageUrl")
        image_name = event.get("imageName")
        if image_url and image_name:
            download_image(image_url, image_name)

    print("\n4. Generating events-data.js...")
    js_content = generate_events_data_js(events)
    with open(EVENTS_DATA_FILE, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  [OK] Written to {EVENTS_DATA_FILE}")

    print("\n5. Pushing to GitHub...")
    git_operations()

    print("\n6. Syncing to Firestore...")
    sync_stats = {"created": 0, "updated": 0, "errors": 0}
    try:
        from sync_firestore import sync_events_to_firestore, mark_closed_events, write_scrape_log
        sync_stats = sync_events_to_firestore(events)
        mark_closed_events()
        print("  [OK] Firestore sync complete")
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

    for src_label in ["ticketmaster", "manual"]:
        src_events = [e for e in events if e.get("source", "manual") == src_label]
        if src_events:
            print(f"\n  [{src_label}] {len(src_events)} events:")
            for e in src_events:
                print(f"    \u2022 {e['artistName']}: {e.get('eventName', '') or '\u2014'} \u2014 {e.get('eventDate', 'TBD')[:10]}")


if __name__ == "__main__":
    main()
