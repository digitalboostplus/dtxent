# AI Research Assistant SOP

## Goal
Discover and evaluate venues, restaurants, hotels, food trucks, and other vendors near event locations. Output structured recommendations that match the website's data format for easy integration.

## Inputs
- Category: `restaurants`, `hotels`, `clubs`, `food_trucks`, `vendors`
- Location: City/address string (e.g., "Hidalgo, TX" or "near Payne Arena")
- Radius: Search radius in miles (default: 25)
- `GEMINI_API_KEY` from `.env`

## Tools
1. `dtxent-site/execution/research_venues.py` — Main script

## Outputs
- `dtxent-site/.tmp/research/YYYY-MM-DD_{category}_{location}.json` — Structured results
- Console summary of top recommendations

## Execution
```
python dtxent-site/execution/research_venues.py --category "restaurants" --location "Hidalgo, TX" --radius 25
```

### Optional flags:
- `--top 10` — Number of results to return (default: 10)
- `--update-site` — Append new entries to `events-data.js` (requires manual review)

## Search Strategy
Uses Gemini with Google Search grounding (`google_search` tool) to find real-time web data. This avoids needing a separate Google Places API key.

### Prompt Template
```
Find the top {top} {category} within {radius} miles of {location}.
For each result provide:
- Business name
- Type/cuisine/category
- City
- Price range ($ to $$$$) if applicable
- Brief description (1-2 sentences, promotional tone)
- Notable features (3 items, e.g. "Live Music", "Outdoor Seating", "Late Night")
- Website URL
- Approximate latitude and longitude

Focus on places that would appeal to concert-goers and event attendees.
Prioritize places with good reviews, unique atmosphere, and proximity to event venues.
Return as a JSON array.
```

## Output Schema
Results are formatted to match existing schemas in `events-data.js`:

### Restaurants
```json
{
  "id": "food-N",
  "name": "Business Name",
  "type": "Cuisine Type",
  "city": "City",
  "price": "$$",
  "image": "assets/placeholder.png",
  "description": "Brief promotional description.",
  "features": ["Feature 1", "Feature 2", "Feature 3"],
  "link": "https://website.com",
  "lat": 26.230,
  "lng": -98.240
}
```

### Hotels
```json
{
  "id": "hotel-N",
  "name": "Hotel Name",
  "city": "City",
  "stars": 4,
  "image": "assets/placeholder.png",
  "description": "Brief description.",
  "features": ["Feature 1", "Feature 2", "Feature 3"],
  "link": "https://website.com",
  "lat": 26.230,
  "lng": -98.240
}
```

### Clubs/Bars
```json
{
  "id": "club-N",
  "name": "Venue Name",
  "type": "Bar Type",
  "city": "City",
  "image": "assets/placeholder.png",
  "description": "Brief description.",
  "features": ["Feature 1", "Feature 2", "Feature 3"],
  "link": "https://website.com",
  "lat": 26.230,
  "lng": -98.240
}
```

## Model
- **Text (with search grounding):** `gemini-3-pro-preview`

## Edge Cases & Learnings
- **No results:** Widen radius or suggest alternative categories.
- **Duplicate detection:** Compare `name` + `city` against existing entries in `events-data.js` before adding.
- **Data quality:** Gemini search grounding can hallucinate details. Cross-reference website URLs.
- **Images:** Script saves `assets/placeholder.png` as default. Use `/venue-research` workflow to source real images.
- **Rate limits:** Gemini search-grounded calls consume more quota. Space requests if batching.
