# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dynamic TX Entertainment landing page - a static promotional website for a Texas-based entertainment company that promotes concerts and events at venues like Payne Arena and South Padre Island.

## Architecture

**Static Single-Page Application:**
- Pure HTML/CSS/JavaScript - no build tools, frameworks, or dependencies
- All code lives in three main files: `index.html`, `styles.css`, `script.js`
- Event images stored in `/assets` directory

**Key Design Patterns:**
- **CSS Custom Properties**: All theming (colors, fonts, transitions) defined in `:root` variables at the top of `styles.css`
- **Modular CSS**: Sections organized by component (header, hero, events, venues, contact, footer)
- **Responsive Grid Layouts**: Events use `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` for automatic responsive behavior
- **Scroll Animations**: Intersection Observer pattern in `script.js` for fade-in effects on scroll

## Development

**Running Locally:**
Simply open `index.html` in a browser, or use any static file server:
```bash
python -m http.server 8000
# or
npx serve
```

**File Structure:**
- `index.html` - Single page containing all sections (hero, upcoming shows, venues, contact)
- `styles.css` - All styles with CSS custom properties for theming
- `script.js` - Header scroll effects, smooth scrolling, and Intersection Observer animations
- `assets/` - Event images and logo

## Content Updates

**Adding New Events:**
Events are hardcoded in `index.html` starting around line 64. Each event card follows this structure:
```html
<article class="event-card">
    <div class="event-image">
        <div class="event-date">
            <span class="month">JAN</span>
            <span class="day">30</span>
        </div>
        <img src="assets/event-image.jpg" alt="Event Name">
    </div>
    <div class="event-details">
        <span class="event-venue">Venue Name, Location</span>
        <h3 class="event-artist">Artist Name</h3>
        <p class="event-info">Tour/Event Name</p>
        <a href="ticket-url" class="btn btn-primary btn-block" target="_blank">Get Tickets</a>
    </div>
</article>
```

**Styling Conventions:**
- Primary brand color: `--primary: #FFCC00` (yellowish gold)
- Background: Dark theme with `--dark-bg: #0a0a0a` and `--card-bg: #161616`
- All interactive elements use `var(--transition)` for consistent 0.3s cubic-bezier animations
- Cards use hover effects with `transform: translateY(-10px)` and glow shadows

**Image Requirements:**
- Event images should be approximately 300x250px (or similar aspect ratio)
- Logo (`dtxent-logo.png`) used in header and footer
- Images support both standard formats (JPG, PNG) and WebP

## Important Notes

- No mobile menu implementation exists yet - the hamburger button is visible on mobile but non-functional
- Newsletter form is purely presentational - no backend submission handling
- All ticket links point to external platforms (Ticketmaster, TixPlug)
- Hero background uses Unsplash placeholder image; video background is commented out
