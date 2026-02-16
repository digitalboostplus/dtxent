"""
generate_social_post.py — Generate a daily social media post for upcoming DTXENT shows.

Uses Google Gemini (gemini-3-pro-preview / Nano Banan Pro) for both:
  - Clickbait caption generation (text)
  - Promotional image generation (native image gen)

Reads event data from dtxent-site/js/events-data.js.
Outputs to .tmp/social_posts/.

Usage:
    python execution/generate_social_post.py
    python execution/generate_social_post.py --days 14
    python execution/generate_social_post.py --platform instagram
    python execution/generate_social_post.py --dry-run
"""

import argparse
import json
import os
import re
import sys
import base64
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent  # dtxent-site/
WORKSPACE_ROOT = REPO_ROOT.parent               # dtxent-builder/

EVENTS_DATA_PATH = REPO_ROOT / "js" / "events-data.js"
OUTPUT_DIR = REPO_ROOT / ".tmp" / "social_posts"
ENV_PATH = WORKSPACE_ROOT / ".env"

MODEL = "gemini-3-pro-preview"

# Platform character limits (caption only, excluding hashtags)
PLATFORM_LIMITS = {
    "twitter": 280,
    "x": 280,
    "instagram": 2200,
    "facebook": 63206,
    "tiktok": 2200,
    "general": 2200,
}

load_dotenv(ENV_PATH)

# ---------------------------------------------------------------------------
# Event Data Loading
# ---------------------------------------------------------------------------


def load_upcoming_events(days_ahead: int = 7) -> list[dict]:
    """
    Parse LOCAL_EVENTS from events-data.js and return events
    occurring within the next `days_ahead` days.
    """
    from js_parser import extract_js_array

    content = EVENTS_DATA_PATH.read_text(encoding="utf-8")
    events = extract_js_array(content, "LOCAL_EVENTS")

    if not events:
        print("ERROR: Could not parse LOCAL_EVENTS from events-data.js")
        return []

    # Filter to upcoming events within the window
    now = datetime.now()
    cutoff = now + timedelta(days=days_ahead)
    upcoming = []

    for event in events:
        if not event.get("isPublished", False):
            continue
        try:
            event_date = datetime.fromisoformat(event["eventDate"])
            if now <= event_date <= cutoff:
                upcoming.append(event)
        except (ValueError, KeyError):
            continue

    # Sort by date
    upcoming.sort(key=lambda e: e["eventDate"])
    return upcoming


# ---------------------------------------------------------------------------
# Gemini Text Generation — Clickbait Caption
# ---------------------------------------------------------------------------


def generate_post_text(
    events: list[dict], platform: str = "general"
) -> dict:
    """
    Use Gemini to generate a clickbait social media caption for upcoming events.
    Returns dict with 'caption', 'hashtags', 'short_caption'.
    """
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set in .env")

    client = genai.Client(api_key=api_key)

    char_limit = PLATFORM_LIMITS.get(platform, 2200)

    # Build event summary for the prompt
    event_lines = []
    for e in events:
        date_obj = datetime.fromisoformat(e["eventDate"])
        date_str = date_obj.strftime("%B %d, %Y")
        name = e.get("eventName") or e.get("artistName", "Live Event")
        artist = e.get("artistName", "")
        venue = e.get("venueName", "")
        city = e.get("venueCity", "")
        state = e.get("venueState", "")
        ticket = e.get("ticketUrl", "")
        event_lines.append(
            f"- {artist} — \"{name}\" at {venue}, {city}, {state} on {date_str}. Tickets: {ticket}"
        )

    events_text = "\n".join(event_lines)

    prompt = f"""You are a social media manager for Dynamic TX Entertainment (DTXENT), 
a company that promotes live concerts and events in Texas.

Write a FIRE social media post promoting these upcoming shows:

{events_text}

RULES:
- Write in a clickbait, hype, high-energy style
- Use emojis strategically (🔥🎶🎤💥🚨🎪)  
- Create URGENCY ("Don't miss out!", "Tickets selling FAST!", "This is going to be INSANE!")
- Mention artist names, venues, and dates
- Include a call to action (get tickets, link in bio, etc.)
- Keep the main caption under {char_limit} characters
- Provide 5-8 hashtags separately (e.g., #DTXENT #LiveMusic #Texas #Concert)
- If multiple events, make it feel like an exciting lineup announcement
- Write for {platform} audience

Return your response as JSON with these exact keys:
{{
    "caption": "the main post caption text",
    "short_caption": "a shorter version under 280 chars for Twitter/X",
    "hashtags": ["#hashtag1", "#hashtag2", ...]
}}

Return ONLY the JSON, no markdown fences or extra text."""

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
    )

    # Parse the response
    response_text = response.text.strip()
    # Strip markdown fences if present
    if response_text.startswith("```"):
        response_text = re.sub(r"```\w*\n?", "", response_text).strip()

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        # Fallback: treat the whole response as the caption
        result = {
            "caption": response_text,
            "short_caption": response_text[:280],
            "hashtags": ["#DTXENT", "#LiveMusic", "#Texas"],
        }

    return result


# ---------------------------------------------------------------------------
# Gemini Image Generation — Nano Banan Pro
# ---------------------------------------------------------------------------


def generate_promo_image(events: list[dict]) -> bytes | None:
    """
    Use Gemini (gemini-3-pro-preview / Nano Banan Pro) to generate
    a promotional image for the featured events.
    Returns PNG image bytes or None on failure.
    """
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set in .env")

    client = genai.Client(api_key=api_key)

    # Build a descriptive prompt for the image
    if len(events) == 1:
        e = events[0]
        artist = e.get("artistName", "Live Event")
        venue = e.get("venueName", "Venue")
        date_obj = datetime.fromisoformat(e["eventDate"])
        date_str = date_obj.strftime("%b %d")
        image_prompt = (
            f"A vibrant, bold, concert promotional social media graphic for "
            f'"{artist}" performing at {venue}. '
            f"Style: neon-lit, high-energy, dark background with electric purple "
            f"and cyan colors, dramatic lighting, modern poster aesthetic. "
            f'Include bold stylized text reading "{artist}" and "{venue} • {date_str}". '
            f"Square format 1080x1080, no watermarks, professional quality. "
            f"The design should feel premium, exciting, and share-worthy."
        )
    else:
        artists = [e.get("artistName", "TBA") for e in events[:4]]
        artists_str = ", ".join(artists)
        image_prompt = (
            f"A vibrant, bold, multi-event concert lineup announcement graphic. "
            f"Featured artists: {artists_str}. "
            f"Style: neon-lit, high-energy, dark background with electric purple "
            f"and gold accents, dramatic lighting, modern poster aesthetic. "
            f'Include bold text reading "UPCOMING SHOWS" and "DTXENT". '
            f"Square format 1080x1080, no watermarks, professional quality. "
            f"The design should feel premium like a festival lineup poster."
        )

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=image_prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )

        # Extract image from response parts
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                return part.inline_data.data

        print("WARNING: No image found in Gemini response")
        return None

    except Exception as e:
        print(f"WARNING: Image generation failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def save_output(
    post_data: dict,
    image_bytes: bytes | None,
    events: list[dict],
) -> dict:
    """
    Save the generated post and image to .tmp/social_posts/.
    Returns a summary dict.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")

    # Save post JSON
    output = {
        "generated_at": datetime.now().isoformat(),
        "model": MODEL,
        "caption": post_data.get("caption", ""),
        "short_caption": post_data.get("short_caption", ""),
        "hashtags": post_data.get("hashtags", []),
        "events_featured": [
            {
                "artist": e.get("artistName"),
                "event": e.get("eventName"),
                "date": e.get("eventDate"),
                "venue": e.get("venueName"),
                "ticket_url": e.get("ticketUrl"),
            }
            for e in events
        ],
        "image_path": None,
    }

    # Save image if available
    if image_bytes:
        image_path = OUTPUT_DIR / f"{today}_image.png"
        image_path.write_bytes(image_bytes)
        output["image_path"] = str(image_path)
        print(f"✅ Image saved: {image_path}")

    # Save JSON
    json_path = OUTPUT_DIR / f"{today}_post.json"
    json_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ Post saved: {json_path}")

    return output


# ---------------------------------------------------------------------------
# Fallback — No Events
# ---------------------------------------------------------------------------


def generate_filler_post() -> dict:
    """Generate a generic 'stay tuned' post when no events are upcoming."""
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set in .env")

    client = genai.Client(api_key=api_key)

    prompt = """You are a social media manager for Dynamic TX Entertainment (DTXENT),
a company that promotes live concerts and events in Texas.

There are no shows in the immediate future, but we want to keep engagement up.
Write a hype post that keeps followers excited — tease upcoming announcements,
ask what artists they want to see, or share a throwback vibe.

Use emojis, be energetic, and include a call to action.

Return as JSON:
{
    "caption": "the post text",
    "short_caption": "shorter version under 280 chars",
    "hashtags": ["#DTXENT", "#LiveMusic", "#Texas"]
}

Return ONLY the JSON."""

    response = client.models.generate_content(model=MODEL, contents=prompt)
    response_text = response.text.strip()
    if response_text.startswith("```"):
        response_text = re.sub(r"```\w*\n?", "", response_text).strip()

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        return {
            "caption": "🔥 Big things coming to Texas! Stay tuned for our next lineup drop. Who do YOU want to see live? Drop your picks below! 👇🎶 #DTXENT #LiveMusic",
            "short_caption": "🔥 Big things coming! Who do you want to see live in TX? Drop names below! 👇🎶 #DTXENT",
            "hashtags": ["#DTXENT", "#LiveMusic", "#Texas", "#ConcertVibes"],
        }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Generate a social media post for upcoming DTXENT shows."
    )
    parser.add_argument(
        "--days", type=int, default=7,
        help="Look ahead N days for upcoming events (default: 7)"
    )
    parser.add_argument(
        "--platform", type=str, default="general",
        choices=list(PLATFORM_LIMITS.keys()),
        help="Optimize for a specific platform (default: general)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Skip image generation, text only"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("🎤 DTXENT Social Media Post Generator")
    print(f"   Model: {MODEL}")
    print(f"   Looking ahead: {args.days} days")
    print(f"   Platform: {args.platform}")
    print("=" * 60)

    # 1. Load upcoming events
    events = load_upcoming_events(days_ahead=args.days)
    print(f"\n📅 Found {len(events)} upcoming event(s)")

    if not events:
        print("   No upcoming events — generating filler post...")
        post_data = generate_filler_post()
        image_bytes = None
        if not args.dry_run:
            image_bytes = generate_promo_image([])  # Will use generic prompt
        events_for_output = []
    else:
        for e in events:
            date_obj = datetime.fromisoformat(e["eventDate"])
            print(f"   • {e.get('artistName', 'TBA')} — {date_obj.strftime('%b %d, %Y')} @ {e.get('venueName', 'TBA')}")

        # 2. Generate caption
        print("\n✍️  Generating caption...")
        post_data = generate_post_text(events, platform=args.platform)
        print(f"   Caption length: {len(post_data.get('caption', ''))} chars")

        # 3. Generate image
        image_bytes = None
        if not args.dry_run:
            print("\n🎨 Generating promo image (Nano Banan Pro)...")
            image_bytes = generate_promo_image(events)
        else:
            print("\n⏭️  Skipping image generation (dry-run)")

        events_for_output = events

    # 4. Save output
    print("\n💾 Saving output...")
    output = save_output(post_data, image_bytes, events_for_output)

    # 5. Print summary
    print("\n" + "=" * 60)
    print("📱 GENERATED POST")
    print("=" * 60)
    print(f"\n{output['caption']}")
    print(f"\n{' '.join(output['hashtags'])}")
    if output.get("image_path"):
        print(f"\n🖼️  Image: {output['image_path']}")
    print("\n" + "=" * 60)
    print("✅ Done!")


if __name__ == "__main__":
    main()
