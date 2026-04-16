"""
sync_firestore_ci.py — CI-friendly Firestore sync for GitHub Actions.

Reads LOCAL_EVENTS from js/events-data.js and upserts them to Firestore.
Expects GOOGLE_APPLICATION_CREDENTIALS to point to the service account JSON file.
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EVENTS_JS = REPO_ROOT / "js" / "events-data.js"


def load_events_from_js() -> list[dict]:
    """Extract LOCAL_EVENTS array from js/events-data.js using regex."""
    content = EVENTS_JS.read_text(encoding="utf-8")
    match = re.search(r"export const LOCAL_EVENTS = (\[.*?\]);", content, re.DOTALL)
    if not match:
        raise ValueError("Could not find LOCAL_EVENTS in events-data.js")
    return json.loads(match.group(1))


def init_firebase():
    """Initialize Firebase Admin SDK via GOOGLE_APPLICATION_CREDENTIALS."""
    import firebase_admin
    from firebase_admin import credentials, firestore

    try:
        return firestore.client(firebase_admin.get_app())
    except ValueError:
        pass

    sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not sa_path or not Path(sa_path).exists():
        raise FileNotFoundError(
            "GOOGLE_APPLICATION_CREDENTIALS not set or file not found. "
            "Set it to the path of your service account JSON file."
        )

    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)
    print(f"  [OK] Firebase initialized from {sa_path}")
    return firestore.client()


def generate_doc_id(event: dict) -> str:
    artist = re.sub(r"[^a-z0-9]", "", event.get("artistName", "").lower())
    date = event.get("eventDate", "")[:10]
    venue = re.sub(r"[^a-z0-9]", "", event.get("venueName", "").lower())
    return f"{artist}_{date}_{venue}"


def parse_date(date_str: str):
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
        except ValueError:
            return None


def sync(events: list[dict], db) -> dict:
    from firebase_admin import firestore as fs

    collection = db.collection("events")
    stats = {"created": 0, "updated": 0, "errors": 0}
    batch = db.batch()
    count = 0

    for event in events:
        try:
            doc_id = generate_doc_id(event)
            ref = collection.document(doc_id)
            existing = ref.get()

            data = {
                "artistName": event.get("artistName", ""),
                "eventName": event.get("eventName", ""),
                "eventDate": parse_date(event.get("eventDate", "")),
                "venueName": event.get("venueName", ""),
                "venueCity": event.get("venueCity", ""),
                "venueState": event.get("venueState", "TX"),
                "ticketUrl": event.get("ticketUrl", ""),
                "isPublished": True,
                "isClosed": False,
                "source": event.get("source", "unknown"),
                "updatedAt": fs.SERVER_TIMESTAMP,
            }

            if event.get("imageName"):
                data["imageUrl"] = f"../assets/{event['imageName']}"
            elif event.get("imageUrl"):
                data["imageUrl"] = event["imageUrl"]

            if event.get("schedule"):
                data["schedule"] = event["schedule"]

            if event.get("dates") and len(event["dates"]) > 1:
                data["dates"] = [
                    {"eventDate": parse_date(d["eventDate"]), "ticketUrl": d.get("ticketUrl", "")}
                    for d in event["dates"]
                ]

            if existing.exists:
                batch.update(ref, data)
                stats["updated"] += 1
            else:
                data["createdAt"] = fs.SERVER_TIMESTAMP
                batch.set(ref, data)
                stats["created"] += 1

            count += 1
            if count >= 500:
                batch.commit()
                batch = db.batch()
                count = 0

        except Exception as e:
            print(f"  [WARN] Error on {event.get('artistName')}: {e}")
            stats["errors"] += 1

    if count > 0:
        batch.commit()

    return stats


def main():
    print("Loading events from js/events-data.js...")
    events = load_events_from_js()
    print(f"  Found {len(events)} events")

    print("Connecting to Firestore...")
    db = init_firebase()

    print("Syncing to Firestore...")
    stats = sync(events, db)
    print(f"  Created: {stats['created']}, Updated: {stats['updated']}, Errors: {stats['errors']}")

    if stats["errors"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
