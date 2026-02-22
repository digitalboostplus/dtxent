document.addEventListener('DOMContentLoaded', () => {
    // Header scroll effect
    const header = document.querySelector('.header');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle with backdrop
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const backdrop = document.querySelector('.mobile-menu-backdrop');

    function openMobileMenu() {
        navLinks.classList.add('active');
        mobileMenuBtn.classList.add('active');
        backdrop.classList.add('active');
        document.body.classList.add('menu-open');
        mobileMenuBtn.setAttribute('aria-expanded', 'true');
    }

    function closeMobileMenu() {
        navLinks.classList.remove('active');
        mobileMenuBtn.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.classList.remove('menu-open');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }

    mobileMenuBtn.addEventListener('click', () => {
        if (navLinks.classList.contains('active')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    // Close menu when clicking backdrop
    if (backdrop) {
        backdrop.addEventListener('click', closeMobileMenu);
    }

    // Close menu when clicking nav links
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('active')) {
            closeMobileMenu();
            mobileMenuBtn.focus(); // Return focus to menu button
        }
    });

    // Smooth scroll for navigation (fallback if GSAP not loaded)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Intersection Observer for scroll animations (fallback for GSAP)
    // Only run if GSAP is not loaded
    setTimeout(() => {
        if (typeof gsap === 'undefined') {
            initFallbackAnimations();
        }
    }, 200);

    // Safety: force-show any hidden animated elements after 3s
    // This catches edge cases where neither GSAP nor the fallback observer triggered
    setTimeout(() => {
        document.querySelectorAll('.hero-title, .hero-subtitle, .hero-btns, .section-header, .contact-content').forEach(el => {
            const computedOpacity = getComputedStyle(el).opacity;
            if (computedOpacity === '0') {
                console.warn('[Safety] Forcing visibility on hidden element:', el);
                el.style.opacity = '1';
                el.style.transform = 'none';
                el.style.transition = 'opacity 0.5s ease';
            }
        });
    }, 3000);

    function initFallbackAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -80px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0) scale(1)';
                        entry.target.classList.add('animated');
                    }, index * 100);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Animate section headers
        const animateElements = document.querySelectorAll('.section-header');
        animateElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(40px) scale(0.95)';
            el.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
            observer.observe(el);
        });

        // Parallax effect for hero (fallback)
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const hero = document.querySelector('.hero-content');
            if (hero && scrolled < window.innerHeight) {
                hero.style.transform = `translateY(${scrolled * 0.5}px)`;
                hero.style.opacity = 1 - (scrolled / window.innerHeight) * 0.5;
            }
        });
    }

    // Keyboard navigation for event cards
    document.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('event-card')) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const ticketLink = e.target.querySelector('.btn-primary');
                if (ticketLink) ticketLink.click();
            }
        }
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('[App] Service Worker registered:', reg.scope))
                .catch(err => console.log('[App] Service Worker registration failed:', err));
        });
    }

    // Performance: Preload critical assets
    const preloadLinks = [
        { href: 'js/events-public.js', as: 'script' },
        { href: 'js/firebase-config.js', as: 'script' }
    ];

    preloadLinks.forEach(link => {
        const preload = document.createElement('link');
        preload.rel = 'modulepreload';
        preload.href = link.href;
        document.head.appendChild(preload);
    });
});
