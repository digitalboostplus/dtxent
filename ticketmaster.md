# Ticketmaster Integration Guide

This document outlines the requirements and implementation plan for integrating with Ticketmaster's API to earn commission/credit on ticket purchases through Dynamic TX Entertainment.

---

## Table of Contents

1. [Overview](#overview)
2. [Integration Options](#integration-options)
3. [Affiliate Program (Recommended)](#affiliate-program-recommended)
4. [Partner API (Advanced)](#partner-api-advanced)
5. [Discovery API](#discovery-api)
6. [Implementation Plan for DTXENT](#implementation-plan-for-dtxent)
7. [Technical Requirements](#technical-requirements)
8. [Next Steps](#next-steps)

---

## Overview

### Goals
- Earn commission on ticket sales referred from dtxent-web.web.app
- Track purchases attributed to Dynamic TX Entertainment
- Eventually integrate event discovery and real-time inventory

### Revenue Opportunity
Ticketmaster's affiliate program pays commission on qualified sales. Commission rates vary by market and are visible in the Impact.com dashboard after approval.

---

## Integration Options

| Feature | Affiliate Program | Partner API |
|---------|------------------|-------------|
| **Effort Level** | Low | High |
| **Setup Time** | Days-Weeks | Months |
| **Revenue Model** | Commission per sale | Negotiated terms |
| **Requirements** | Impact.com account | Business relationship with TM |
| **Technical Work** | URL wrapping only | Full API integration |
| **Best For** | Starting out | High-volume partners |

**Recommendation:** Start with the Affiliate Program, then pursue Partner API as volume grows.

---

## Affiliate Program (Recommended)

### What It Is
The Ticketmaster Global Affiliate Program allows publishers to earn commission by referring ticket sales through tracked URLs. Ticketmaster uses **Impact.com** as their affiliate network platform.

### Geographic Coverage
The program covers 29 markets worldwide:
- **North America:** USA, Canada, Mexico
- **Europe:** UK, France, Germany, Spain, Italy, Netherlands, Belgium, Austria, Switzerland, Ireland, Poland, Czech Republic, Denmark, Finland, Norway, Sweden, Greece, Cyprus, Turkey
- **Middle East:** UAE, Saudi Arabia
- **Africa:** South Africa
- **Oceania:** Australia, New Zealand
- **South America:** Brazil, Chile, Peru

### Sign-Up Process

1. **Apply via Impact.com**
   - Visit: https://developer.ticketmaster.com/partners/distribution-partners/affiliate-sign-up/
   - Click the affiliate sign-up link to apply through Impact
   - Complete the application form with business details

2. **Application Review**
   - Ticketmaster reviews your audience and business category
   - Approval typically takes 1-2 weeks
   - You'll be accepted to all markets (some exceptions may apply)

3. **Upon Approval You Receive:**
   - Affiliate partner onboarding guide
   - Impact publisher ID
   - API key for Discovery API access
   - Access to Discovery Feed

4. **Set Up Impact Account**
   - Create/configure your Impact publisher account
   - Impact handles tracking, reporting, and payments
   - Review commission structures per market in dashboard

### How Tracking Works

1. **Get Your Impact Publisher ID** after approval

2. **Wrap Destination URLs** with Impact click tracking:
   ```
   Original URL:
   https://www.ticketmaster.com/event/3A00631B93932239

   Tracked URL (example format):
   https://impact.go/your-publisher-id?destination=https://www.ticketmaster.com/event/3A00631B93932239
   ```

3. **When a user clicks your tracked link:**
   - Impact sets tracking cookies
   - User completes purchase on Ticketmaster
   - Sale is attributed to your account
   - Commission is recorded in Impact dashboard

4. **Tracking Endpoint** (Partner API):
   ```
   GET /partners/v1/tracking?event_id={event_id}&apikey={apikey}
   ```

### Commission Rates
- Rates vary by market and event type
- View specific rates in your Impact dashboard
- Typically ranges from 2-8% of ticket price
- Paid monthly via Impact

---

## Partner API (Advanced)

### What It Is
The Partner API enables approved partners to facilitate **transactional ticketing** directly on their platforms - reserve, purchase, and manage tickets programmatically.

### Access Requirements
- **Not publicly available** - restricted to official distribution partners
- Requires existing business relationship with Ticketmaster
- Contact: Distributed Commerce team at Ticketmaster
- Inquiry email: devportalinquiry@ticketmaster.com

### Authentication
Partners receive an API key from Ticketmaster:

```javascript
// Query parameter
GET /partners/v1/events?apikey=YOUR_API_KEY

// OR Header
GET /partners/v1/events
x-api-key: YOUR_API_KEY
```

### Core Capabilities

**Event & Inventory:**
- Retrieve event details
- Check ticket availability and inventory status
- Access Top Picks recommendations
- Support for resale inventory

**Cart Operations:**
- Reserve tickets (flexible seating options)
- Select shipping methods (eTicket, mail, Will Call)
- Add billing via Braintree tokens
- Commit purchases
- Delete abandoned carts

**Order Management:**
- Retrieve order details and redemption status
- Access unredeemed orders
- Process refunds (single or batch)
- SafeTix rotating barcode support

### API Environments

| Environment | Base URL |
|-------------|----------|
| Pre-Production | `https://app.ticketmaster.com/partners-preprod/v1` |
| Production | `https://app.ticketmaster.com/partners/v1` |

All connections require HTTPS/SSL.

### Key Endpoints

```
POST   /partners/v1/events/{id}/cart          # Create cart/reserve tickets
GET    /partners/v1/cart/{cartId}             # Get cart details
PUT    /partners/v1/cart/{cartId}/billing     # Add billing info
POST   /partners/v1/cart/{cartId}/checkout    # Complete purchase
DELETE /partners/v1/cart/{cartId}             # Abandon cart
GET    /partners/v1/orders/{orderId}          # Get order details
POST   /partners/v1/orders/{orderId}/refund   # Process refund
```

---

## Discovery API

### What It Is
Free, public API to search for events, attractions, and venues. Available immediately upon registration.

### Access
- **Rate Limit:** 5,000 calls/day, 5 requests/second
- **Deep Paging:** Max 1,000 results (size * page < 1000)
- **Registration:** https://developer.ticketmaster.com/

### Key Endpoints

```
GET /discovery/v2/events          # Search events
GET /discovery/v2/events/{id}     # Event details
GET /discovery/v2/attractions     # Search attractions/artists
GET /discovery/v2/venues          # Search venues
```

### Example: Search Events by Venue

```javascript
const API_KEY = 'your-api-key';
const PAYNE_ARENA_ID = 'KovZpZAEdntA'; // Example venue ID

fetch(`https://app.ticketmaster.com/discovery/v2/events.json?venueId=${PAYNE_ARENA_ID}&apikey=${API_KEY}`)
  .then(res => res.json())
  .then(data => console.log(data._embedded.events));
```

### Data Sources
- Ticketmaster
- Universe
- FrontGate Tickets
- Ticketmaster Resale (TMR)

Filter by source: `&source=ticketmaster`

---

## Implementation Plan for DTXENT

### Current State
- Events displayed on landing page with direct Ticketmaster URLs
- No tracking or attribution
- No commission earned

### Phase 1: Affiliate Tracking (Immediate)
1. Apply to Ticketmaster Affiliate Program via Impact.com
2. Receive Impact publisher ID and API key
3. Update `js/events-data.js` ticket URLs with Impact tracking
4. Optionally create URL wrapper utility function
5. Test attribution with test purchases

**Code Change Example:**
```javascript
// js/url-tracker.js
export function wrapTicketmasterUrl(originalUrl, eventId) {
    const impactId = 'YOUR_IMPACT_ID';
    return `https://goto.impact.com/${impactId}?destination=${encodeURIComponent(originalUrl)}`;
}
```

### Phase 2: Discovery API Integration (Short-term)
1. Register for Discovery API key
2. Fetch event data directly from Ticketmaster
3. Auto-sync events instead of manual entry
4. Display real-time ticket availability

### Phase 3: Partner API (Future)
1. Build volume through affiliate program
2. Apply for Partner API access
3. Implement in-app ticket purchasing
4. Direct checkout without leaving site

---

## Technical Requirements

### For Affiliate Program
- [ ] Impact.com publisher account
- [ ] Impact publisher ID
- [ ] Discovery API key (provided with affiliate approval)
- [ ] URL wrapping implementation in code

### For Partner API
- [ ] Official Ticketmaster partnership agreement
- [ ] Partner API key
- [ ] Braintree payment integration
- [ ] SSL/HTTPS (already have)
- [ ] Order management system
- [ ] Webhook handling for order updates

### For Discovery API
- [ ] API key (free registration)
- [ ] Rate limiting implementation
- [ ] Caching strategy (events don't change frequently)

---

## Next Steps

### Immediate Actions
1. **Apply to Affiliate Program**
   - Go to: https://developer.ticketmaster.com/partners/distribution-partners/affiliate-sign-up/
   - Complete Impact.com application
   - Business details needed: website, audience size, traffic sources

2. **Register for Discovery API**
   - Go to: https://developer.ticketmaster.com/
   - Create developer account
   - Get free API key instantly

3. **Document Current Ticket URLs**
   - Audit all Ticketmaster event links in `js/events-data.js`
   - Prepare list for URL conversion after approval

### After Affiliate Approval
4. **Configure Impact Dashboard**
   - Review commission rates per market
   - Set up payment details
   - Get tracking link format

5. **Implement URL Tracking**
   - Create utility function for URL wrapping
   - Update all Ticketmaster links in events data
   - Test with live click-through

6. **Verify Attribution**
   - Make test purchase
   - Confirm sale appears in Impact dashboard
   - Verify commission calculation

---

## Resources

- **Developer Portal:** https://developer.ticketmaster.com/
- **Affiliate Sign-Up:** https://developer.ticketmaster.com/partners/distribution-partners/affiliate-sign-up/
- **Discovery API Docs:** https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
- **Partner API Docs:** https://developer.ticketmaster.com/products-and-docs/apis/partner/
- **API Explorer:** https://developer.ticketmaster.com/explore/
- **Support Email:** devportalinquiry@ticketmaster.com

---

## Appendix: Event ID Mapping

Current Ticketmaster events in DTXENT:

| Event | Ticketmaster Event ID | Current URL |
|-------|----------------------|-------------|
| Jeff Dunham | 3A00631B93932239 | ticketmaster.com/.../event/3A00631B93932239 |
| Ty Myers | 3A00632487D67426 | ticketmaster.com/.../event/3A00632487D67426 |
| Pandora Y Flans | 3A0062A1860C3884 | ticketmaster.com/.../event/3A0062A1860C3884 |
| Los Angeles Azules | 3A00634E94D967D7 | ticketmaster.com/.../event/3A00634E94D967D7 |
| Reik | 3A006377F8B7D2C4 | ticketmaster.com/.../event/3A006377F8B7D2C4 |
| Alejandro Sanz | 3A006355DAD69751 | ticketmaster.com/.../event/3A006355DAD69751 |

*These IDs will be used with the Discovery API and for tracking URL generation.*
