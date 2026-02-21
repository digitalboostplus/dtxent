/**
 * Site Configuration Loader
 * Fetches siteConfig docs from Firestore and applies to the public site.
 * Falls back silently to hardcoded HTML defaults if any doc is missing or fails.
 */
import { db } from './firebase-config.js';
import {
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

async function loadSiteConfig() {
    try {
        const [hero, sections, social, footer, newsletter, seo, theme] = await Promise.allSettled([
            getDoc(doc(db, 'siteConfig', 'hero')),
            getDoc(doc(db, 'siteConfig', 'sections')),
            getDoc(doc(db, 'siteConfig', 'social')),
            getDoc(doc(db, 'siteConfig', 'footer')),
            getDoc(doc(db, 'siteConfig', 'newsletter')),
            getDoc(doc(db, 'siteConfig', 'seo')),
            getDoc(doc(db, 'siteConfig', 'theme'))
        ]);

        if (hero.status === 'fulfilled' && hero.value.exists()) applyHero(hero.value.data());
        if (sections.status === 'fulfilled' && sections.value.exists()) applySections(sections.value.data());
        if (social.status === 'fulfilled' && social.value.exists()) applySocial(social.value.data());
        if (footer.status === 'fulfilled' && footer.value.exists()) applyFooter(footer.value.data());
        if (newsletter.status === 'fulfilled' && newsletter.value.exists()) applyNewsletter(newsletter.value.data());
        if (seo.status === 'fulfilled' && seo.value.exists()) applySeo(seo.value.data());
        if (theme.status === 'fulfilled' && theme.value.exists()) applyTheme(theme.value.data());
    } catch (error) {
        // Silent fail - site renders with hardcoded defaults
        console.warn('Site config load error:', error);
    }
}

function applyHero(data) {
    const titleEl = document.getElementById('hero-title');
    const subtitleEl = document.getElementById('hero-subtitle');
    const ctaBtn = document.getElementById('hero-cta');

    if (titleEl && (data.title || data.highlightedText)) {
        const title = data.title || '';
        const highlighted = data.highlightedText || '';
        if (highlighted && title.includes(highlighted)) {
            // Wrap highlighted text in gradient span
            titleEl.innerHTML = title.replace(
                highlighted,
                `<span class="text-gradient">${escapeHtml(highlighted)}</span>`
            ).replace(/\n/g, '<br>');
        } else if (title) {
            titleEl.innerHTML = escapeHtml(title).replace(/\n/g, '<br>');
        }
    }

    if (subtitleEl && data.subtitle) {
        subtitleEl.textContent = data.subtitle;
    }

    if (ctaBtn) {
        if (data.ctaText) ctaBtn.textContent = data.ctaText;
        if (data.ctaLink) ctaBtn.href = data.ctaLink;
    }

    // Background image
    if (data.backgroundImageUrl) {
        const hero = document.getElementById('hero');
        if (hero) {
            hero.style.backgroundImage = `url('${data.backgroundImageUrl}')`;
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = 'center';
        }
    }
}

function applySections(data) {
    const sectionMap = {
        upcoming: { titleId: 'upcoming-title', descSelector: '#upcoming .section-desc' },
        nightlife: { titleId: 'nightlife-title', descSelector: '#nightlife .section-desc' },
        dining: { titleId: 'dining-title', descSelector: '#dining .section-desc' },
        stay: { titleId: 'stay-title', descSelector: '#stay .section-desc' },
        newsletter: { titleId: 'contact-title', descSelector: '#newsletter-desc' }
    };

    Object.entries(sectionMap).forEach(([key, config]) => {
        const sectionData = data[key];
        if (!sectionData) return;

        const titleEl = document.getElementById(config.titleId);
        if (titleEl && (sectionData.title || sectionData.highlightedWord)) {
            const title = sectionData.title || '';
            const highlight = sectionData.highlightedWord || '';
            const highlightClass = key === 'newsletter' ? 'text-gradient' : 'text-highlight';
            if (highlight) {
                titleEl.innerHTML = `${escapeHtml(title)} <span class="${highlightClass}">${escapeHtml(highlight)}</span>`;
            } else if (title) {
                titleEl.textContent = title;
            }
        }

        if (sectionData.description) {
            const descEl = document.querySelector(config.descSelector);
            if (descEl) descEl.textContent = sectionData.description;
        }
    });
}

function applySocial(data) {
    const socialLinks = document.querySelectorAll('.footer-social a');
    socialLinks.forEach(link => {
        const label = link.getAttribute('aria-label') || '';
        if (label.includes('Facebook') && data.facebook) link.href = data.facebook;
        if (label.includes('Instagram') && data.instagram) link.href = data.instagram;
        if (label.includes('Twitter') && data.twitter) link.href = data.twitter;
    });
}

function applyFooter(data) {
    if (data.copyrightText) {
        const footerP = document.querySelector('.footer-brand p');
        if (footerP) footerP.innerHTML = data.copyrightText;
    }
}

function applyNewsletter(data) {
    if (data.placeholderText) {
        const input = document.querySelector('.newsletter-form input[type="email"]');
        if (input) input.placeholder = data.placeholderText;
    }
    if (data.buttonText) {
        const btn = document.querySelector('.newsletter-form button[type="submit"]');
        if (btn) btn.textContent = data.buttonText;
    }
}

function applySeo(data) {
    if (data.pageTitle) {
        document.title = data.pageTitle;
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const twTitle = document.querySelector('meta[property="twitter:title"]');
        if (ogTitle) ogTitle.content = data.pageTitle;
        if (twTitle) twTitle.content = data.pageTitle;
    }
    if (data.metaDescription) {
        const metaDesc = document.querySelector('meta[name="description"]');
        const ogDesc = document.querySelector('meta[property="og:description"]');
        const twDesc = document.querySelector('meta[property="twitter:description"]');
        if (metaDesc) metaDesc.content = data.metaDescription;
        if (ogDesc) ogDesc.content = data.metaDescription;
        if (twDesc) twDesc.content = data.metaDescription;
    }
    if (data.keywords) {
        const metaKw = document.querySelector('meta[name="keywords"]');
        if (metaKw) metaKw.content = data.keywords;
    }
    if (data.ogImageUrl) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        const twImg = document.querySelector('meta[property="twitter:image"]');
        if (ogImg) ogImg.content = data.ogImageUrl;
        if (twImg) twImg.content = data.ogImageUrl;
    }
}

function applyTheme(data) {
    const root = document.documentElement;
    if (data.primaryColor) root.style.setProperty('--primary', data.primaryColor);
    if (data.primaryHoverColor) root.style.setProperty('--primary-hover', data.primaryHoverColor);
    if (data.darkBgColor) root.style.setProperty('--dark-bg', data.darkBgColor);
    if (data.cardBgColor) root.style.setProperty('--card-bg', data.cardBgColor);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Auto-initialize
loadSiteConfig();
