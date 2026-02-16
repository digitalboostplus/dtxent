---
description: Generate a daily social media post for upcoming DTXENT shows
---

# Generate Social Media Post

Creates a clickbait social media caption + AI-generated promo image for upcoming shows using Gemini 3 Pro Preview (Nano Banan Pro).

## Prerequisites
- `GEMINI_API_KEY` set in `.env`
- Python with `google-genai` and `Pillow` installed
- `dtxent-site/js/events-data.js` exists with upcoming events

## Steps

// turbo-all

1. Generate the social media post (text + image)
```
python execution/generate_social_post.py --days 7 --platform general
```

2. Review output
```
dir .tmp\social_posts\
```

3. (Optional) View the generated post JSON
```
type .tmp\social_posts\*_post.json
```

## Variations

### Dry run (text only, no image generation)
```
python execution/generate_social_post.py --dry-run
```

### Platform-specific
```
python execution/generate_social_post.py --platform instagram
python execution/generate_social_post.py --platform twitter
```

### Extended lookahead
```
python execution/generate_social_post.py --days 30
```
