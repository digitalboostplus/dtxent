---
description: Research event venues and create dedicated landing pages
---

1. Scrape all unique venue names and locations from `index.html`.
2. For each venue found:
    a. Use `search_web` to research the venue (Description, History, Capacity, Amenities, and Address).
    b. Use `browser_subagent` or `search_web` to find and capture high-quality, authentic images of the location's interior and exterior.
    c. Create a dedicated HTML page (`venue-[name-slug].html`) using the project's CSS and brand guidelines.
    d. Ensure the page includes:
        - A hero section with the generated image.
        - Detailed venue information.
        - A list of upcoming events at that specific venue (filtered from the main show list).
3. Update the "Venues" section in `index.html` with the new images and links to the dedicated pages.
4. Verify the responsiveness and visual consistency across all new pages.
