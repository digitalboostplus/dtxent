// GSAP Animations - ScrollTrigger powered animations
// Requires GSAP and ScrollTrigger to be loaded first

// Wait for GSAP to be available
function initGSAPAnimations() {
    // Check if GSAP is loaded
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        console.warn('GSAP or ScrollTrigger not loaded');
        return;
    }

    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        console.log('Reduced motion preference detected, skipping GSAP animations');
        return;
    }

    // Register ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // Hero entrance animation
    initHeroAnimation();

    // Section animations
    initSectionAnimations();

    // Parallax effects
    initParallax();

    // Magnetic button effects
    initMagneticButtons();

    console.log('GSAP animations initialized');
}

/**
 * Force all animated elements to be visible (fallback for failures)
 */
function forceShowAll() {
    document.querySelectorAll('.section-header, .contact-content').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
    });
}

/**
 * Hero entrance animation
 */
function initHeroAnimation() {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from('.hero-title', {
        y: 100,
        opacity: 0,
        duration: 1.2,
        delay: 0.3
    })
        .from('.hero-subtitle', {
            y: 50,
            opacity: 0,
            duration: 0.8
        }, '-=0.6')
        .from('.hero-btns .btn', {
            y: 30,
            opacity: 0,
            stagger: 0.15,
            duration: 0.6
        }, '-=0.4');
}

/**
 * Section title and content animations
 */
function initSectionAnimations() {
    // Section titles
    gsap.utils.toArray('.section-title').forEach(title => {
        gsap.from(title, {
            scrollTrigger: {
                trigger: title,
                start: 'top 85%',
                end: 'top 60%',
                toggleActions: 'play none none reverse'
            },
            y: 50,
            opacity: 0,
            scale: 0.95,
            duration: 0.8,
            ease: 'power2.out'
        });
    });

    // Section descriptions
    gsap.utils.toArray('.section-desc').forEach(desc => {
        gsap.from(desc, {
            scrollTrigger: {
                trigger: desc,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            y: 30,
            opacity: 0,
            duration: 0.6,
            delay: 0.2,
            ease: 'power2.out'
        });
    });


    // Contact section
    gsap.from('.contact-content', {
        scrollTrigger: {
            trigger: '.contact',
            start: 'top 70%',
            toggleActions: 'play none none reverse'
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });

    // Footer
    gsap.from('.footer-content', {
        scrollTrigger: {
            trigger: '.footer',
            start: 'top 90%',
            toggleActions: 'play none none reverse'
        },
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out'
    });
}

/**
 * Parallax scrolling effects
 */
function initParallax() {
    // Hero content parallax
    gsap.to('.hero-content', {
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 1.5
        },
        y: 150,
        opacity: 0.3,
        ease: 'none'
    });

    // Hero background zoom
    gsap.to('.video-bg', {
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 1
        },
        scale: 1.15,
        ease: 'none'
    });
}

/**
 * Magnetic button hover effect
 */
function initMagneticButtons() {
    const buttons = gsap.utils.toArray('.btn-primary, .btn-outline');

    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            gsap.to(button, {
                scale: 1.05,
                duration: 0.3,
                ease: 'power2.out'
            });
        });

        button.addEventListener('mouseleave', () => {
            gsap.to(button, {
                scale: 1,
                x: 0,
                y: 0,
                duration: 0.3,
                ease: 'elastic.out(1, 0.5)'
            });
        });

        button.addEventListener('mousemove', (e) => {
            const { left, top, width, height } = button.getBoundingClientRect();
            const x = (e.clientX - left - width / 2) * 0.15;
            const y = (e.clientY - top - height / 2) * 0.15;

            gsap.to(button, {
                x,
                y,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });
}

/**
 * Animate event cards when they load dynamically
 */
export function animateEventCards() {
    if (typeof gsap === 'undefined') return;

    const cards = document.querySelectorAll('.event-card');

    cards.forEach((card, index) => {
        gsap.from(card, {
            y: 60,
            opacity: 0,
            scale: 0.95,
            duration: 0.6,
            delay: index * 0.1,
            ease: 'power2.out',
            clearProps: 'all'
        });
    });
}

// Initialize when DOM is ready and GSAP is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            initGSAPAnimations();
        } catch (err) {
            console.error('GSAP init failed, forcing elements visible:', err);
            forceShowAll();
        }
    });
} else {
    // Small delay to ensure GSAP scripts are loaded
    setTimeout(() => {
        try {
            initGSAPAnimations();
        } catch (err) {
            console.error('GSAP init failed, forcing elements visible:', err);
            forceShowAll();
        }
    }, 100);
}
