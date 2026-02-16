"""
sync_firestore.py — Sync events to Firestore with isClosed management.

Responsibilities:
1. Initialize Firebase Admin SDK with service account
2. Upsert events to Firestore (dedupe by composite key)
3. Mark past events as isClosed=true
4. Handle batch operations efficiently
"""

import os
import re
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# Firebase Admin SDK (lazy initialization)
_db = None
_initialized = False


def init_firebase():
    """Initialize Firebase Admin SDK with service account credentials."""
    global _db, _initialized

    if _initialized:
        return _db

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        # Check for existing app
        try:
            app = firebase_admin.get_app()
            _db = firestore.client()
            _initialized = True
            return _db
        except ValueError:
            pass  # No app exists, proceed to initialize

        # Get service account path from env
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

        if not service_account_path:
            # Try default location
            default_path = PROJECT_ROOT / "firebase-service-account.json"
            if default_path.exists():
                service_account_path = str(default_path)
            else:
                raise ValueError(
                    "FIREBASE_SERVICE_ACCOUNT_PATH not set in .env and "
                    "firebase-service-account.json not found in project root.\n"
                    "Please download your service account key from Firebase Console:\n"
                    "  Project Settings > Service Accounts > Generate New Private Key"
                )

        # Resolve relative paths
        if not os.path.isabs(service_account_path):
            service_account_path = str(PROJECT_ROOT / service_account_path)

        if not os.path.exists(service_account_path):
            raise FileNotFoundError(f"Service account file not found: {service_account_path}")

        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
        _initialized = True

        print("  [OK] Firebase Admin SDK initialized")
        return _db

    except ImportError:
        raise ImportError(
            "firebase-admin package not installed. Run: pip install firebase-admin"
        )


def generate_event_id(event: dict) -> str:
    """Generate deterministic Firestore document ID from event data."""
    # Normalize: artistName + eventDate (YYYY-MM-DD) + venueName
    artist = re.sub(r"[^a-z0-9]", "", event.get("artistName", "").lower())
    date = event.get("eventDate", "")[:10]  # YYYY-MM-DD
    venue = re.sub(r"[^a-z0-9]", "", event.get("venueName", "").lower())
    return f"{artist}_{date}_{venue}"


def sync_events_to_firestore(events: list[dict]) -> dict:
    """
    Sync events to Firestore using batch writes.

    Args:
        events: List of event dictionaries from scraping

    Returns:
        dict with counts: {'created': N, 'updated': N, 'unchanged': N}
    """
    from firebase_admin import firestore

    db = init_firebase()
    events_ref = db.collection("events")

    stats = {"created": 0, "updated": 0, "unchanged": 0, "errors": 0}

    # Process in batches of 500 (Firestore limit)
    batch = db.batch()
    batch_count = 0

    for event in events:
        try:
            doc_id = generate_event_id(event)
            doc_ref = events_ref.document(doc_id)

            # Check if document exists
            existing = doc_ref.get()

            # Prepare event data for Firestore
            event_data = {
                "artistName": event.get("artistName", ""),
                "eventName": event.get("eventName", ""),
                "eventDate": parse_event_date(event.get("eventDate", "")),
                "venueName": event.get("venueName", ""),
                "venueCity": event.get("venueCity", ""),
                "venueState": event.get("venueState", "TX"),
                "ticketUrl": event.get("ticketUrl", ""),
                "isPublished": True,
                "isClosed": False,
                "source": event.get("source", "unknown"),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }

            # Handle image - prefer imageName for local assets
            if event.get("imageName"):
                event_data["imageUrl"] = f"../assets/{event['imageName']}"
            elif event.get("imageUrl"):
                event_data["imageUrl"] = event["imageUrl"]

            # Include schedule if present
            if event.get("schedule"):
                event_data["schedule"] = event["schedule"]

            # Include dates array for multi-date shows
            if event.get("dates") and len(event["dates"]) > 1:
                event_data["dates"] = [
                    {
                        "eventDate": parse_event_date(d.get("eventDate", "")),
                        "ticketUrl": d.get("ticketUrl", "")
                    }
                    for d in event["dates"]
                ]

            if existing.exists:
                # Update existing document
                batch.update(doc_ref, event_data)
                stats["updated"] += 1
            else:
                # Create new document
                event_data["createdAt"] = firestore.SERVER_TIMESTAMP
                batch.set(doc_ref, event_data)
                stats["created"] += 1

            batch_count += 1

            # Commit batch at 500 operations
            if batch_count >= 500:
                batch.commit()
                batch = db.batch()
                batch_count = 0

        except Exception as e:
            print(f"    [WARN] Error syncing {event.get('artistName', 'unknown')}: {e}")
            stats["errors"] += 1

    # Commit remaining operations
    if batch_count > 0:
        batch.commit()

    print(f"    Created: {stats['created']}, Updated: {stats['updated']}, Errors: {stats['errors']}")
    return stats


def mark_closed_events() -> int:
    """
    Mark past events as isClosed=true.

    Events are considered "closed" if their eventDate is more than 6 hours in the past.

    Returns:
        Number of events marked as closed
    """
    from firebase_admin import firestore

    db = init_firebase()
    events_ref = db.collection("events")

    # Calculate cutoff time (6 hours ago)
    cutoff = datetime.now() - timedelta(hours=6)

    # Query events where eventDate < cutoff AND isClosed != true
    # Note: Firestore doesn't support != directly, so we query all past events
    # and filter client-side
    past_events = events_ref.where("eventDate", "<", cutoff).stream()

    batch = db.batch()
    count = 0

    for doc in past_events:
        data = doc.to_dict()
        # Only update if not already closed
        if not data.get("isClosed", False):
            batch.update(doc.reference, {
                "isClosed": True,
                "updatedAt": firestore.SERVER_TIMESTAMP
            })
            count += 1

            # Commit batch at 500 operations
            if count % 500 == 0:
                batch.commit()
                batch = db.batch()

    # Commit remaining operations
    if count % 500 != 0:
        batch.commit()

    if count > 0:
        print(f"    Marked {count} past events as closed")

    return count


def parse_event_date(date_str: str):
    """Parse event date string to Firestore Timestamp."""
    from firebase_admin import firestore

    if not date_str:
        return None

    try:
        # Handle ISO format: 2026-02-21T20:00:00
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt
    except ValueError:
        try:
            # Try parsing just the date
            dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
            return dt
        except ValueError:
            print(f"    [WARN] Could not parse date: {date_str}")
            return None


def get_all_events() -> list[dict]:
    """Retrieve all events from Firestore (for debugging/verification)."""
    db = init_firebase()
    events_ref = db.collection("events")
    events = []

    for doc in events_ref.stream():
        event = doc.to_dict()
        event["id"] = doc.id
        events.append(event)

    return events


def delete_event(event_id: str) -> bool:
    """Delete a specific event from Firestore."""
    db = init_firebase()
    try:
        db.collection("events").document(event_id).delete()
        return True
    except Exception as e:
        print(f"Error deleting event {event_id}: {e}")
        return False


# CLI for manual testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python sync_firestore.py [test|mark-closed|list]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "test":
        # Test Firebase connection
        print("Testing Firebase connection...")
        db = init_firebase()
        print("  [OK] Connected successfully")

        # Count events
        events_ref = db.collection("events")
        count = len(list(events_ref.limit(100).stream()))
        print(f"  Found {count} events in Firestore")

    elif command == "mark-closed":
        # Manually mark closed events
        print("Marking past events as closed...")
        count = mark_closed_events()
        print(f"Done. Marked {count} events as closed.")

    elif command == "list":
        # List all events
        print("Fetching all events from Firestore...")
        events = get_all_events()
        for e in events:
            status = "CLOSED" if e.get("isClosed") else "OPEN"
            print(f"  [{status}] {e.get('artistName')}: {e.get('eventName')} - {e.get('eventDate')}")
        print(f"\nTotal: {len(events)} events")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
