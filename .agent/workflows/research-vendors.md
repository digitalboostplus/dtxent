---
description: Research event venues and create dedicated landing pages
---

# Research Vendors & Venues

Uses the AI Research Assistant (Gemini 3 Pro Preview with Google Search grounding) to discover venues, restaurants, hotels, food trucks, and other vendors near DTXENT event locations.

## Prerequisites
- `GEMINI_API_KEY` set in `.env`
- Python with `google-genai` installed
- `dtxent-site/js/events-data.js` exists (for duplicate detection)

## Steps

// turbo-all

1. Run the research assistant for the desired category and location
```
python dtxent-site/execution/research_venues.py --category "restaurants" --location "Hidalgo, TX" --radius 25 --top 10
```

2. Review the output report
```
dir dtxent-site\.tmp\research\
```

3. View the results
```
type dtxent-site\.tmp\research\*restaurants*.json
```

## Common Searches

### Restaurants near Payne Arena
```
python dtxent-site/execution/research_venues.py --category "restaurants" --location "Payne Arena, Hidalgo, TX" --radius 15
```

### Hotels near South Padre Island
```
python dtxent-site/execution/research_venues.py --category "hotels" --location "South Padre Island, TX" --radius 10
```

### Food trucks in the RGV
```
python dtxent-site/execution/research_venues.py --category "food_trucks" --location "McAllen, TX" --radius 30
```

### Nightlife / clubs
```
python dtxent-site/execution/research_venues.py --category "clubs" --location "McAllen, TX" --radius 10
```

### Event vendors (catering, rentals, etc.)
```
python dtxent-site/execution/research_venues.py --category "vendors" --location "Hidalgo, TX" --radius 25
```

## Adding Results to Website
Use the `--update-site` flag to generate a pending update file:
```
python dtxent-site/execution/research_venues.py --category "restaurants" --location "Hidalgo, TX" --update-site
```
This saves a `pending_update_restaurants.json` in `dtxent-site/.tmp/research/` for manual review before integrating into `events-data.js`.
