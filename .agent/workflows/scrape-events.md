---
description: Scrape events from tixplug.com and paynearena.com, then update dtxent.com
---

# Scrape Events & Update DTXent Website

This workflow scrapes all upcoming shows from tixplug.com and paynearena.com, then updates the dtxent.com website (hosted on GitHub).

## Prerequisites
- Python with `requests` and `beautifulsoup4` installed
- Git credentials configured for pushing to `digitalboostplus/dtxent`
- The `dtxent-site/` directory must be a clone of the repo

## Steps

// turbo-all

1. Scrape TixPlug events via WordPress REST API
```
python execution/scrape_tixplug.py
```

2. Scrape Payne Arena events via HTML
```
python execution/scrape_paynearena.py
```

3. Merge events, update events-data.js, download images, and push to GitHub
```
python execution/update_dtxent.py
```

4. Verify the push was successful
```
git -C dtxent-site log --oneline -3
```
