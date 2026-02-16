"""
research_venues.py — AI-powered research assistant for discovering venues, restaurants,
hotels, food trucks, and other vendors near DTXENT event locations.

Uses Google Gemini (gemini-3-pro-preview) with Google Search grounding to find
real-time business data and format it for the DTXENT website.

Outputs structured JSON matching the schemas in events-data.js
(LOCAL_RESTAURANTS, LOCAL_HOTELS, LOCAL_CLUBS).

Usage:
    python execution/research_venues.py --category "restaurants" --location "Hidalgo, TX"
    python execution/research_venues.py --category "food_trucks" --location "Payne Arena, Hidalgo, TX" --radius 15
    python execution/research_venues.py --category "hotels" --location "South Padre Island, TX" --top 5
    python execution/research_venues.py --category "clubs" --location "McAllen, TX" --update-site
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent  # dtxent-site/
WORKSPACE_ROOT = REPO_ROOT.parent               # dtxent-builder/

EVENTS_DATA_PATH = REPO_ROOT / "js" / "events-data.js"
OUTPUT_DIR = REPO_ROOT / ".tmp" / "research"
ENV_PATH = WORKSPACE_ROOT / ".env"

MODEL = "gemini-3-pro-preview"

# Category to schema mapping
CATEGORY_SCHEMAS = {
    "restaurants": {
        "array_name": "LOCAL_RESTAURANTS",
        "id_prefix": "food",
        "fields": ["id", "name", "type", "city", "price", "image", "description", "features", "link", "lat", "lng"],
    },
    "hotels": {
        "array_name": "LOCAL_HOTELS",
        "id_prefix": "hotel",
        "fields": ["id", "name", "city", "stars", "image", "description", "features", "link", "lat", "lng"],
    },
    "clubs": {
        "array_name": "LOCAL_CLUBS",
        "id_prefix": "club",
        "fields": ["id", "name", "type", "city", "image", "description", "features", "link", "lat", "lng"],
    },
    "food_trucks": {
        "array_name": "LOCAL_RESTAURANTS",
        "id_prefix": "food",
        "fields": ["id", "name", "type", "city", "price", "image", "description", "features", "link", "lat", "lng"],
    },
    "vendors": {
        "array_name": "LOCAL_CLUBS",
        "id_prefix": "vendor",
        "fields": ["id", "name", "type", "city", "image", "description", "features", "link", "lat", "lng"],
    },
}

VALID_CATEGORIES = list(CATEGORY_SCHEMAS.keys())

load_dotenv(ENV_PATH)


# ---------------------------------------------------------------------------
# Existing Data Loading (for duplicate detection)
# ---------------------------------------------------------------------------


def load_existing_entries(category: str) -> list[dict]:
    """
    Load existing entries from events-data.js for duplicate detection.
    Returns a list of dicts with at least 'name' and 'city'.
    """
    from js_parser import extract_js_array

    schema = CATEGORY_SCHEMAS.get(category)
    if not schema:
        return []

    array_name = schema["array_name"]
    content = EVENTS_DATA_PATH.read_text(encoding="utf-8")
    return extract_js_array(content, array_name)


# ---------------------------------------------------------------------------
# Gemini Search — Grounded Research
# ---------------------------------------------------------------------------


def search_vendors(
    category: str,
    location: str,
    radius: int = 25,
    top: int = 10,
) -> list[dict]:
    """
    Use Gemini with Google Search grounding to find businesses.
    Returns a list of structured results.
    """
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set in .env")

    client = genai.Client(api_key=api_key)

    # Build category-specific prompt additions
    category_context = {
        "restaurants": "Focus on dining experiences that concert-goers and event attendees would enjoy — late-night options, pre-show dinner spots, and unique local cuisine.",
        "hotels": "Focus on hotels and resorts convenient for event-goers — proximity to venues, amenities, and quality. Include star ratings.",
        "clubs": "Focus on nightlife venues, bars, and clubs with live music, DJ nights, or a vibrant atmosphere that complements the concert experience.",
        "food_trucks": "Focus on food trucks and mobile vendors popular in the area — especially those that serve at events, festivals, or popular gathering spots.",
        "vendors": "Focus on event-related vendors — catering services, party rentals, merchandise vendors, or any businesses that could partner with a concert promotion company.",
    }

    context = category_context.get(category, "")

    # Schema-specific field requests
    schema = CATEGORY_SCHEMAS[category]
    if category in ("restaurants", "food_trucks"):
        fields_instruction = """For each result, return:
- name: Business name
- type: Cuisine type or food category
- city: City name
- price: Price range using $ symbols ($, $$, $$$, $$$$)
- description: 1-2 sentence promotional description
- features: Array of exactly 3 notable features
- link: Official website URL (use "#" if unknown)
- lat: Approximate latitude (number)
- lng: Approximate longitude (number)"""
    elif category == "hotels":
        fields_instruction = """For each result, return:
- name: Hotel/resort name
- city: City name
- stars: Star rating (1-5, as number)
- description: 1-2 sentence promotional description
- features: Array of exactly 3 notable amenities
- link: Official website URL (use "#" if unknown)
- lat: Approximate latitude (number)
- lng: Approximate longitude (number)"""
    else:
        fields_instruction = """For each result, return:
- name: Business/venue name
- type: Category or type of business
- city: City name
- description: 1-2 sentence promotional description
- features: Array of exactly 3 notable features
- link: Official website URL (use "#" if unknown)
- lat: Approximate latitude (number)
- lng: Approximate longitude (number)"""

    prompt = f"""Find the top {top} {category.replace('_', ' ')} within {radius} miles of {location}.

{context}

{fields_instruction}

Also include a "confidence_score" (0.0 to 1.0) indicating how confident you are this business exists and the information is accurate.

Return ONLY a JSON array of objects. No markdown fences, no extra text.
Example: [{{"name": "Example Place", "type": "Mexican", ...}}]"""

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )

        response_text = response.text.strip()
        # Strip markdown fences if present
        if response_text.startswith("```"):
            response_text = re.sub(r"```\w*\n?", "", response_text).strip()

        results = json.loads(response_text)
        if isinstance(results, list):
            return results
        else:
            print("WARNING: Response was not a JSON array")
            return []

    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse Gemini response as JSON: {e}")
        print(f"Raw response:\n{response_text[:500]}")
        return []
    except Exception as e:
        print(f"ERROR: Gemini search failed: {e}")
        return []


# ---------------------------------------------------------------------------
# Scoring & Ranking
# ---------------------------------------------------------------------------


def score_and_rank(results: list[dict]) -> list[dict]:
    """
    Sort results by confidence score (descending).
    Filter out low-confidence results.
    """
    scored = []
    for r in results:
        confidence = r.get("confidence_score", 0.5)
        if confidence >= 0.3:  # Minimum threshold
            r["confidence_score"] = round(confidence, 2)
            scored.append(r)

    scored.sort(key=lambda x: x.get("confidence_score", 0), reverse=True)
    return scored


# ---------------------------------------------------------------------------
# Formatting for Website
# ---------------------------------------------------------------------------


def format_for_website(
    results: list[dict],
    category: str,
    existing_count: int = 0,
) -> list[dict]:
    """
    Format results to match the schema used in events-data.js.
    Assigns sequential IDs starting after existing entries.
    """
    schema = CATEGORY_SCHEMAS[category]
    id_prefix = schema["id_prefix"]
    formatted = []

    for i, r in enumerate(results):
        entry_id = f"{id_prefix}-{existing_count + i + 1}"

        entry = {
            "id": entry_id,
            "name": r.get("name", "Unknown"),
            "city": r.get("city", ""),
            "image": f"assets/{r.get('name', 'placeholder').lower().replace(' ', '-')}.png",
            "description": r.get("description", ""),
            "features": r.get("features", [])[:3],
            "link": r.get("link", "#"),
            "lat": r.get("lat", 0),
            "lng": r.get("lng", 0),
        }

        # Add category-specific fields
        if category in ("restaurants", "food_trucks"):
            entry["type"] = r.get("type", "Dining")
            entry["price"] = r.get("price", "$$")
        elif category == "hotels":
            entry["stars"] = r.get("stars", 3)
        elif category in ("clubs", "vendors"):
            entry["type"] = r.get("type", "Venue")

        # Preserve confidence score for review
        entry["_confidence"] = r.get("confidence_score", 0.5)

        formatted.append(entry)

    return formatted


# ---------------------------------------------------------------------------
# Duplicate Detection
# ---------------------------------------------------------------------------


def filter_duplicates(
    new_entries: list[dict], existing_entries: list[dict]
) -> list[dict]:
    """
    Remove entries that already exist in events-data.js.
    Matches on name (case-insensitive) + city.
    """
    existing_keys = set()
    for e in existing_entries:
        key = (e.get("name", "").strip().lower(), e.get("city", "").strip().lower())
        existing_keys.add(key)

    unique = []
    for entry in new_entries:
        key = (entry.get("name", "").strip().lower(), entry.get("city", "").strip().lower())
        if key not in existing_keys:
            unique.append(entry)
        else:
            print(f"   ⏭️  Skipping duplicate: {entry['name']} ({entry['city']})")

    return unique


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def save_report(results: list[dict], category: str, location: str) -> Path:
    """Save research results to .tmp/research/."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    safe_location = re.sub(r"[^a-zA-Z0-9]", "_", location).strip("_").lower()
    filename = f"{today}_{category}_{safe_location}.json"
    filepath = OUTPUT_DIR / filename

    report = {
        "generated_at": datetime.now().isoformat(),
        "model": MODEL,
        "category": category,
        "location": location,
        "result_count": len(results),
        "results": results,
    }

    filepath.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return filepath


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="AI Research Assistant — discover venues, restaurants, hotels, and vendors."
    )
    parser.add_argument(
        "--category", type=str, required=True,
        choices=VALID_CATEGORIES,
        help=f"Category to search: {', '.join(VALID_CATEGORIES)}"
    )
    parser.add_argument(
        "--location", type=str, required=True,
        help="Location to search near (e.g., 'Hidalgo, TX', 'near Payne Arena')"
    )
    parser.add_argument(
        "--radius", type=int, default=25,
        help="Search radius in miles (default: 25)"
    )
    parser.add_argument(
        "--top", type=int, default=10,
        help="Number of results to return (default: 10)"
    )
    parser.add_argument(
        "--update-site", action="store_true",
        help="Append new entries to events-data.js (use with caution)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("🔍 DTXENT AI Research Assistant")
    print(f"   Model: {MODEL}")
    print(f"   Category: {args.category}")
    print(f"   Location: {args.location}")
    print(f"   Radius: {args.radius} miles")
    print(f"   Top: {args.top}")
    print("=" * 60)

    # 1. Load existing data for duplicate detection
    existing = load_existing_entries(args.category)
    print(f"\n📦 Existing entries in events-data.js: {len(existing)}")

    # 2. Search with Gemini
    print(f"\n🔎 Searching for {args.category} near {args.location}...")
    raw_results = search_vendors(
        category=args.category,
        location=args.location,
        radius=args.radius,
        top=args.top,
    )
    print(f"   Found {len(raw_results)} raw results")

    if not raw_results:
        print("\n❌ No results found. Try widening the radius or adjusting the location.")
        sys.exit(0)

    # 3. Score and rank
    ranked = score_and_rank(raw_results)
    print(f"   {len(ranked)} results passed confidence threshold")

    # 4. Format for website
    formatted = format_for_website(ranked, args.category, len(existing))

    # 5. Remove duplicates
    unique = filter_duplicates(formatted, existing)
    print(f"   {len(unique)} new unique entries")

    # 6. Save report
    report_path = save_report(unique, args.category, args.location)
    print(f"\n💾 Report saved: {report_path}")

    # 7. Print results
    print("\n" + "=" * 60)
    print(f"📋 TOP {args.category.upper().replace('_', ' ')} NEAR {args.location.upper()}")
    print("=" * 60)

    for i, entry in enumerate(unique, 1):
        conf = entry.pop("_confidence", "?")
        print(f"\n{i}. {entry['name']}")
        print(f"   City: {entry.get('city', 'N/A')}")
        if "type" in entry:
            print(f"   Type: {entry['type']}")
        if "price" in entry:
            print(f"   Price: {entry['price']}")
        if "stars" in entry:
            print(f"   Stars: {'⭐' * entry['stars']}")
        print(f"   {entry.get('description', '')}")
        print(f"   Features: {', '.join(entry.get('features', []))}")
        print(f"   Link: {entry.get('link', '#')}")
        print(f"   Confidence: {conf}")

    # 8. Optional: update events-data.js
    if args.update_site and unique:
        print(f"\n⚠️  --update-site flag detected.")
        print(f"   Would add {len(unique)} entries to {CATEGORY_SCHEMAS[args.category]['array_name']}.")
        print(f"   NOTE: Manual review recommended before deploying.")
        # For safety, we just save the formatted entries — actual file editing
        # should be done through the agent orchestration layer or manually.
        update_path = OUTPUT_DIR / f"pending_update_{args.category}.json"
        update_path.write_text(
            json.dumps(unique, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"   Pending update saved: {update_path}")

    print("\n" + "=" * 60)
    print("✅ Done!")


if __name__ == "__main__":
    main()
