# Scrape Events SOP

## Goal
Fetch all upcoming events from **tixplug.com** and **paynearena.com**, then update the dtxent.com website (hosted on GitHub) with the show details and ticket links.

## Inputs
- None (source URLs are hardcoded in the scripts)

## Tools
1. `dtxent-site/execution/scrape_tixplug.py` — Fetches events via WordPress REST API
2. `dtxent-site/execution/scrape_paynearena.py` — Scrapes events from Squarespace HTML
3. `dtxent-site/execution/update_dtxent.py` — Merges events, regenerates `events-data.js`, downloads images, commits & pushes

## Outputs
- `dtxent-site/.tmp/tixplug_events.json` — Raw scraped tixplug events
- `dtxent-site/.tmp/paynearena_events.json` — Raw scraped paynearena events
- Updated `dtxent-site/js/events-data.js` with fresh `LOCAL_EVENTS` array
- Updated `dtxent-site/assets/` with downloaded event poster images
- Git commit + push to `https://github.com/digitalboostplus/dtxent.git`
- Firestore `events` collection synced with all events (isClosed=false for upcoming, isClosed=true for past)

## Execution Order
```
python dtxent-site/execution/scrape_tixplug.py
python dtxent-site/execution/scrape_paynearena.py
python dtxent-site/execution/update_dtxent.py
```

## Data Schema (per event)
Each scraped event maps to this structure for `LOCAL_EVENTS`:
```json
{
  "artistName": "Snow Tha Product",
  "eventName": "Before I Crashout",
  "eventDate": "2026-06-15T20:00:00",
  "venueName": "South Padre Island",
  "venueCity": "South Padre Island",
  "venueState": "TX",
  "imageName": "snow_tha_product.jpg",
  "ticketUrl": "https://tixplug.com/shop/snow-tha-product-before-i-crashout/",
  "isPublished": true,
  "source": "tixplug"
}
```

## Edge Cases & Learnings
- **Sub-products:** TixPlug lists VIP seats, GA tickets, and table options as separate WooCommerce products. Filter them out by checking `featured_media > 0` and `product_cat` not in `[uncategorized]`.
- **Date parsing:** Dates are embedded in the excerpt HTML as plain text (e.g. "Date: Saturday, February 21st, 2026"). Use regex to extract.
- **Pagination:** WP REST API returns max 100 per page. Check `X-WP-TotalPages` header.
- **Image downloads:** Featured images require a second API call to `/wp-json/wp/v2/media/{id}` to get the actual URL.
- **Payne Arena:** Squarespace site structure may change. If scraping fails, check for updated class names or section IDs.
- **Git push:** Requires git credentials configured on the machine. Uses `git -C dtxent-site/` for operations.
- **Deduplication:** Uses composite key (artist + date + venue) to preserve multi-date events from same artist.
- **Firestore sync:** Requires `firebase-service-account.json` in project root. Get from Firebase Console > Project Settings > Service Accounts. If missing, sync is skipped gracefully.
- **isClosed field:** Events older than 6 hours are automatically marked `isClosed=true` on each sync run.
