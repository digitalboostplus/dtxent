"""
generate_report.py - DTXENT site update incident + resolution PDF report.
"""

from fpdf import FPDF
from fpdf.enums import XPos, YPos
from datetime import date
from pathlib import Path

OUTPUT = str(Path(__file__).resolve().parent.parent / "DTXENT_Site_Update_Report.pdf")

FONTS = {
    "regular": "C:/Windows/Fonts/arial.ttf",
    "bold":    "C:/Windows/Fonts/arialbd.ttf",
    "italic":  "C:/Windows/Fonts/ariali.ttf",
}

BRAND_GOLD  = (255, 204, 0)
BRAND_DARK  = (10,  10,  10)
BODY_TEXT   = (220, 220, 220)
MUTED       = (155, 155, 155)
WHITE       = (255, 255, 255)
RED_BG      = (45,  10,  10)
RED_FG      = (220, 70,  70)
GREEN_BG    = (10,  38,  20)
GREEN_FG    = (60,  190, 110)
BLUE_BG     = (10,  20,  45)
BLUE_FG     = (80,  150, 230)
GOLD_BG     = (38,  32,  5)


class Report(FPDF):

    def setup_fonts(self):
        self.add_font("Arial",       fname=FONTS["regular"])
        self.add_font("Arial",  "B", fname=FONTS["bold"])
        self.add_font("Arial",  "I", fname=FONTS["italic"])

    def header(self):
        self.set_fill_color(*BRAND_GOLD)
        self.rect(0, 0, 210, 4, "F")

    def footer(self):
        self.set_y(-14)
        self.set_font("Arial", "I", 8)
        self.set_text_color(*MUTED)
        self.cell(
            0, 6,
            f"DTXENT Internal Report  |  {date.today().strftime('%B %d, %Y')}  |  Page {self.page_no()}",
            align="C",
        )
        self.set_fill_color(*BRAND_GOLD)
        self.rect(0, 293, 210, 4, "F")

    # ── helpers ──────────────────────────────────────────────────────────

    def dark_page(self):
        self.add_page()
        self.set_fill_color(*BRAND_DARK)
        self.rect(0, 0, 210, 297, "F")

    def cover(self):
        # Gold accent bar on left
        self.set_fill_color(*BRAND_GOLD)
        self.rect(0, 88, 8, 82, "F")

        self.set_xy(18, 94)
        self.set_font("Arial", "B", 10)
        self.set_text_color(*BRAND_GOLD)
        self.cell(0, 7, "DYNAMIC TX ENTERTAINMENT",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_x(18)
        self.set_font("Arial", "B", 26)
        self.set_text_color(*WHITE)
        self.multi_cell(175, 12, "Site Update\nIncident Report", align="L")

        self.set_x(18)
        self.set_font("Arial", "I", 12)
        self.set_text_color(*MUTED)
        self.cell(0, 7, "Diagnosis, Resolution & Process Changes",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Date badge
        self.set_xy(18, 176)
        self.set_fill_color(*BRAND_GOLD)
        self.set_text_color(*BRAND_DARK)
        self.set_font("Arial", "B", 10)
        self.cell(68, 8, f"  {date.today().strftime('%B %d, %Y')}  ",
                  fill=True, align="C")

        self.set_xy(18, 192)
        self.set_font("Arial", "I", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 5, "Prepared by: DTXent Automation System")

    def h1(self, text: str):
        self.set_xy(10, self.get_y() + 2)
        self.set_font("Arial", "B", 15)
        self.set_text_color(*WHITE)
        self.cell(0, 9, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*BRAND_GOLD)
        self.set_line_width(0.4)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def section(self, number: str, title: str):
        self.ln(5)
        self.set_fill_color(*BRAND_GOLD)
        self.set_text_color(*BRAND_DARK)
        self.set_font("Arial", "B", 9)
        self.cell(8, 7, number, fill=True, align="C")
        self.set_text_color(*WHITE)
        self.set_font("Arial", "B", 12)
        self.cell(0, 7, f"  {title}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*BRAND_GOLD)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def body(self, text: str, indent: int = 10):
        self.set_font("Arial", "", 10)
        self.set_text_color(*BODY_TEXT)
        self.set_x(indent)
        self.multi_cell(190 - indent, 5.5, text)
        self.ln(2)

    def bullet_list(self, items: list, color=None, indent: int = 12):
        c = color or BRAND_GOLD
        for item in items:
            self.set_x(indent)
            self.set_font("Arial", "B", 11)
            self.set_text_color(*c)
            self.cell(5, 5.5, "\u2022")
            self.set_font("Arial", "", 10)
            self.set_text_color(*BODY_TEXT)
            self.multi_cell(185 - indent, 5.5, item)
        self.ln(2)

    def callout(self, title: str, lines: list, style: str = "issue"):
        palette = {
            "issue":   (RED_FG,   RED_BG),
            "fixed":   (GREEN_FG, GREEN_BG),
            "info":    (BLUE_FG,  BLUE_BG),
            "warning": (BRAND_GOLD, GOLD_BG),
        }
        fg, bg = palette.get(style, (RED_FG, RED_BG))

        y = self.get_y()
        row_h = 5.5
        box_h = 7 + len(lines) * row_h + 4

        self.set_fill_color(*bg)
        self.rect(10, y, 190, box_h, "F")
        self.set_fill_color(*fg)
        self.rect(10, y, 3, box_h, "F")

        self.set_xy(15, y + 3)
        self.set_font("Arial", "B", 10)
        self.set_text_color(*fg)
        self.cell(0, 5, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        for line in lines:
            self.set_x(15)
            self.set_font("Arial", "", 9)
            self.set_text_color(*BODY_TEXT)
            self.multi_cell(183, row_h, line)

        self.ln(4)

    def status_row(self, label: str, status: str, note: str = ""):
        colors = {
            "FIXED":    GREEN_FG,
            "DEPLOYED": GREEN_FG,
            "PENDING":  MUTED,
            "BLOCKED":  RED_FG,
        }
        color = colors.get(status, MUTED)
        self.set_x(10)
        self.set_font("Arial", "", 10)
        self.set_text_color(*BODY_TEXT)
        self.cell(100, 6, label)
        self.set_font("Arial", "B", 9)
        self.set_text_color(*color)
        self.cell(28, 6, f"[{status}]")
        if note:
            self.set_font("Arial", "I", 8.5)
            self.set_text_color(*MUTED)
            self.multi_cell(0, 6, note)
        else:
            self.ln()

    def two_col_compare(self, left_title, left_items, right_title, right_items):
        y = self.get_y()
        col_w = 90
        row_h = 6

        for side, sx, fg, bg, items, stitle in [
            ("left",  10,  RED_FG,   RED_BG,   left_items,  left_title),
            ("right", 110, GREEN_FG, GREEN_BG, right_items, right_title),
        ]:
            box_h = 8 + len(items) * row_h + 4
            self.set_fill_color(*bg)
            self.rect(sx, y, col_w, box_h, "F")
            self.set_fill_color(*fg)
            self.rect(sx, y, 3, box_h, "F")
            self.set_xy(sx + 5, y + 3)
            self.set_font("Arial", "B", 9)
            self.set_text_color(*fg)
            self.cell(col_w - 8, 5, stitle,
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            for item in items:
                self.set_x(sx + 5)
                self.set_font("Arial", "", 9)
                self.set_text_color(*BODY_TEXT)
                self.cell(col_w - 8, row_h, item,
                          new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.ln(max(len(left_items), len(right_items)) * row_h + 18)


# ── Build ─────────────────────────────────────────────────────────────────

pdf = Report()
pdf.setup_fonts()
pdf.set_auto_page_break(auto=True, margin=18)
pdf.set_margins(10, 16, 10)

# Cover
pdf.dark_page()
pdf.cover()

# ── Page 2: Executive Summary ─────────────────────────────────────────────
pdf.dark_page()
pdf.set_xy(10, 20)
pdf.h1("Executive Summary")

pdf.body(
    "On April 16, 2026, a routine website update for dtxent.com was initiated to refresh "
    "event listings scraped from Payne Arena and TixPlug. During this process, several "
    "pre-existing technical issues surfaced in the browser console, a duplicate event listing "
    "was discovered, and the Firestore database sync had never been wired into the deployment "
    "pipeline. This report details each issue, its root cause, and the remediation applied."
)

pdf.section("1", "Issues Found")

pdf.callout(
    "GSAP Animation Warning - .video-bg Element Not Found",
    [
        "Every page load triggered a GSAP warning because animations.js was targeting",
        "the CSS class .video-bg for a parallax scroll effect, but the video background",
        "element was commented out of index.html and never present in the live DOM.",
        "Impact: Console warning on every load (no visible effect to users).",
    ],
    "issue",
)

pdf.callout(
    "Firestore 403 - Lifestyle Collections Not in Security Rules",
    [
        "The lifestyle-public.js module attempted to load clubs, restaurants, and hotels",
        "from Firestore on page load. These three collections had no explicit rules,",
        "so the catch-all deny rule blocked all reads. The site fell back to local data,",
        "but logged permission errors on every page load.",
        "Impact: Firestore ignored; local data used silently as fallback.",
    ],
    "issue",
)

pdf.callout(
    "Newsletter Webhook 403 - Cloud Functions Not Publicly Invocable",
    [
        "The /api/newsletter-webhook endpoint returned 403 after form submissions.",
        "Root cause: Firebase Functions v2 runs on Cloud Run, which requires explicit",
        "IAM invoker permissions. The functions were deployed without granting the",
        "Firebase Hosting service account (dtxent-web@appspot.gserviceaccount.com)",
        "the roles/run.invoker role on the Cloud Run services.",
        "An org-level IAM policy also blocked granting public access to allUsers.",
        "Impact: Newsletter CRM forwarding silently failed; Firestore save still worked.",
    ],
    "issue",
)

pdf.callout(
    "Duplicate Event - Highly Motavated 420 Comedy Special",
    [
        "The update script produced two separate event cards for the same show:",
        "one from the manual events list (no image, shorter name) and one from",
        "TixPlug (with image, full name including 'ft Raymond Orta and Friends').",
        "The deduplication logic keys on artist name + date + venue. Because the",
        "artist names differed slightly, both entries passed through.",
        "Impact: Two cards for the same event displayed on the website.",
    ],
    "issue",
)

pdf.callout(
    "Missing Venue - South Side Texas Tour (May 8 date)",
    [
        "The TixPlug scraper extracted venue details from product titles, but the",
        "May 8 listing had no location in its title (unlike the May 9 'Corpus Christi'",
        "entry). This left venueName and venueCity blank for that date.",
        "Impact: Event card showed no venue for the Harlingen show.",
    ],
    "issue",
)

pdf.callout(
    "Firestore Never Wired Into Deployment Pipeline",
    [
        "The sync_firestore.py script required a service account JSON file that did",
        "not exist locally, and FIREBASE_SERVICE_ACCOUNT_PATH was not set in .env.",
        "Every automated update silently skipped the Firestore sync entirely.",
        "The admin dashboard was therefore running on stale data.",
        "Impact: Admin dashboard events out of sync with the live website.",
    ],
    "issue",
)

# ── Page 3: Fixes ─────────────────────────────────────────────────────────
pdf.dark_page()
pdf.set_xy(10, 20)
pdf.h1("Resolutions Applied")
pdf.section("2", "Fixes Deployed")

pdf.callout(
    "FIX 1 - GSAP .video-bg Warning",
    [
        "Added a DOM existence check before the GSAP parallax call in js/animations.js:",
        "  if (document.querySelector('.video-bg')) { gsap.to('.video-bg', {...}); }",
        "The animation only runs if the element is present, eliminating the warning.",
        "File: js/animations.js  |  Deployed via: GitHub Actions (hosting)",
    ],
    "fixed",
)

pdf.callout(
    "FIX 2 - Firestore Lifestyle Collection Permissions",
    [
        "Added explicit public-read rules for clubs, restaurants, and hotels in",
        "firestore.rules, matching the pattern already used for the events collection:",
        "  match /clubs/{club}    { allow read: if true; ... }",
        "  match /restaurants/{r} { allow read: if true; ... }",
        "  match /hotels/{hotel}  { allow read: if true; ... }",
        "File: firestore.rules  |  Deployed via: firebase deploy (rules)",
    ],
    "fixed",
)

pdf.callout(
    "FIX 3 - Newsletter Webhook 403",
    [
        "Granted the Firebase Hosting service account (dtxent-web@appspot.gserviceaccount.com)",
        "the roles/run.invoker IAM role on all three Cloud Run services:",
        "  newsletterwebhook, vipwebhook, ticketmasterproxy",
        "Applied directly via gcloud IAM (org policy blocked allUsers grant).",
        "No code change required; IAM update takes effect immediately.",
    ],
    "fixed",
)

pdf.callout(
    "FIX 4 - Duplicate Highly Motavated 420 Event",
    [
        "Merged both entries into a single canonical record:",
        "  artistName: 'Highly Motavated 420 Comedy Special'",
        "  eventName:  'ft Raymond Orta and Friends'",
        "  imageUrl:   TixPlug image (preserved from scraped entry)",
        "  source:     tixplug  (manual entry removed)",
        "File: js/events-data.js  |  Committed and pushed to main",
    ],
    "fixed",
)

pdf.callout(
    "FIX 5 - South Side Texas Tour Venue",
    [
        "Fetched the TixPlug event page directly to confirm the venue details:",
        "  Venue:  The Moon Rock, 1811 W Jefferson Ave, Harlingen, TX 78550",
        "  Date:   Friday May 8, 2026  |  Doors: 7:00 PM",
        "  Note:   Lil Flip confirmed as special guest",
        "Updated venueName and venueCity in events-data.js.",
        "File: js/events-data.js  |  Committed and pushed to main",
    ],
    "fixed",
)

pdf.callout(
    "FIX 6 - Firestore Sync Added to Deployment Pipeline",
    [
        "Created execution/sync_firestore_ci.py - a CI-ready sync script that reads",
        "LOCAL_EVENTS from js/events-data.js and upserts them to Firestore using",
        "the GOOGLE_APPLICATION_CREDENTIALS environment variable.",
        "Updated .github/workflows/firebase-hosting-merge.yml to run the Firestore",
        "sync automatically on every push to main, using the existing",
        "FIREBASE_SERVICE_ACCOUNT_DTXENT_WEB GitHub secret.",
    ],
    "fixed",
)

# ── Page 4: Pipeline + Status ─────────────────────────────────────────────
pdf.dark_page()
pdf.set_xy(10, 20)
pdf.h1("Before & After - Deployment Pipeline")
pdf.section("3", "Pipeline Comparison")

pdf.two_col_compare(
    "BEFORE (Broken Pipeline)",
    [
        "1. Run scrapers",
        "2. Merge & deduplicate events",
        "3. Download images",
        "4. Update events-data.js",
        "5. Firestore sync  -- SKIPPED",
        "   (missing service account)",
        "6. Git commit & push",
        "7. GitHub Actions -> hosting only",
        "   Firestore never updated",
    ],
    "AFTER (Fixed Pipeline)",
    [
        "1. Run scrapers",
        "2. Merge & deduplicate events",
        "3. Download images",
        "4. Update events-data.js",
        "5. Git commit & push",
        "6. GitHub Actions:",
        "   a. Validate event data",
        "   b. Sync to Firestore  [NEW]",
        "   c. Deploy hosting",
    ],
)

pdf.section("4", "Current Status - All Issues")
pdf.ln(2)

rows = [
    ("GSAP .video-bg console warning",           "FIXED",   "Guard added in animations.js"),
    ("Firestore clubs/restaurants/hotels 403",   "FIXED",   "Rules deployed"),
    ("Newsletter webhook 403",                   "FIXED",   "IAM granted to Hosting SA"),
    ("Duplicate Highly Motavated 420 event",     "FIXED",   "Merged in events-data.js"),
    ("South Side Texas Tour missing venue",      "FIXED",   "The Moon Rock, Harlingen TX"),
    ("Firestore sync never running",             "FIXED",   "Added to GitHub Actions workflow"),
    ("Firebase CLI session expired",             "PENDING", "Run: firebase login --reauth"),
    ("Service account key missing locally",      "PENDING", "Download from Firebase Console"),
]
for label, status, note in rows:
    pdf.status_row(label, status, note)

pdf.ln(5)
pdf.section("5", "Remaining Manual Steps")
pdf.bullet_list([
    "Re-authenticate Firebase CLI: Open a regular terminal and run  firebase login --reauth",
    "Optional local Firestore sync: Download a service account JSON from Firebase Console "
    "(Project Settings > Service Accounts > Generate New Private Key) and save it to the "
    "project root as firebase-service-account.json for running syncs locally.",
    "Verify the GitHub Actions run triggered by today's push completed successfully "
    "at github.com/digitalboostplus/dtxent/actions",
])

# ── Page 5: Event Listing ─────────────────────────────────────────────────
pdf.dark_page()
pdf.set_xy(10, 20)
pdf.h1("Current Event Listing - April 16, 2026")
pdf.section("6", "19 Events Now Live on dtxent.com")

events = [
    ("Apr 20",  "Highly Motavated 420 Comedy Special", "ft Raymond Orta and Friends",    "Citrus Live, Edinburg TX"),
    ("Apr 25",  "Pop Punk Party Night",                "Anthem 182 (Blink-182 Tribute)", "Citrus Live, Edinburg TX"),
    ("May 1",   "Emerson, Lake & Palmer",              "The United Tour",                "Payne Arena, Hidalgo TX"),
    ("May 8",   "South Side Texas Tour",               "Uno G Live + Lil Flip",          "The Moon Rock, Harlingen TX"),
    ("May 9",   "South Side Texas Tour",               "Uno G Live - Corpus Christi",    "Corpus Christi TX"),
    ("May 9",   "City of Alamo Watermelon Fest '26",  "",                               "Alamo Sports Complex TX"),
    ("May 9",   "Alejandro Sanz",                      "Y Ahora Que Gira",               "Payne Arena, Hidalgo TX"),
    ("May 15",  "Lost in Hollywood & Testify",         "SOD / RAM Tributes",             "Citrus Live, Edinburg TX"),
    ("May 20",  "Carin Leon",                          "De Sonora Para El Mundo Tour",   "Payne Arena, Hidalgo TX"),
    ("May 21",  "Carin Leon (Night 2)",                "De Sonora Para El Mundo Tour",   "Payne Arena, Hidalgo TX"),
    ("May 28",  "Puppy Pals Live",                     "Live Show",                      "Payne Arena, Hidalgo TX"),
    ("May 29",  "NB Ridaz",                            "Runaway Throwback Night",        "Citrus Live, Edinburg TX"),
    ("May 29",  "Grupo Bryndis & Industria Del Amor", "Romanticos Tour",                "Payne Arena, Hidalgo TX"),
    ("Jun 12",  "Braxton Keith",                       "Live at Payne Arena",            "Payne Arena, Hidalgo TX"),
    ("Jun 20",  "Seltzer Island Fest",                 "South Padre Island",             "Cameron County Amphitheater"),
    ("Oct 2",   "Marisela Eterna Tour 2026",           "Live at Payne Arena",            "Payne Arena, Hidalgo TX"),
    ("Oct 17",  "Mon Laferte",                         "Femme Fatale Tour",              "Payne Arena, Hidalgo TX"),
    ("Dec 13",  "Blue October",                        "Foiled 20th Anniversary Tour",   "Payne Arena, Hidalgo TX"),
    ("Feb '27", "Cristian Castro",                     "Nada Solo Exitos Tour",          "Payne Arena, Hidalgo TX"),
]

# Header row
pdf.set_x(10)
pdf.set_fill_color(28, 28, 28)
pdf.set_text_color(*BRAND_GOLD)
pdf.set_font("Arial", "B", 8.5)
for w, label in [(20, "DATE"), (62, "ARTIST"), (58, "EVENT / TOUR"), (50, "VENUE")]:
    pdf.cell(w, 7, label, fill=True)
pdf.ln()

for i, (dt, artist, event, venue) in enumerate(events):
    pdf.set_fill_color(*(18, 18, 18) if i % 2 == 0 else (24, 24, 24))
    pdf.set_x(10)
    pdf.set_font("Arial", "", 8.5)
    pdf.set_text_color(*MUTED)
    pdf.cell(20, 6.5, dt, fill=True)
    pdf.set_font("Arial", "B", 8.5)
    pdf.set_text_color(*BODY_TEXT)
    pdf.cell(62, 6.5, artist[:36], fill=True)
    pdf.set_font("Arial", "", 8.5)
    pdf.set_text_color(*BODY_TEXT)
    pdf.cell(58, 6.5, event[:34], fill=True)
    pdf.set_text_color(*MUTED)
    pdf.cell(50, 6.5, venue[:32], fill=True)
    pdf.ln()

pdf.ln(5)
pdf.set_x(10)
pdf.set_font("Arial", "I", 8.5)
pdf.set_text_color(*MUTED)
pdf.cell(0, 5, "Sources: paynearena.com (11)  |  tixplug.com (10)  |  manual (11)")

# ── Save ─────────────────────────────────────────────────────────────────
pdf.output(OUTPUT)
print(f"[OK] Report saved: {OUTPUT}")
