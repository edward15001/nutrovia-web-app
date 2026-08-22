// ─── NutroVia — main.js (Landing Page) ───────────────────

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');
const navActions = document.querySelector('.nav-actions');
navToggle?.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navActions.classList.toggle('open');
});

// Particles animation
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${Math.random() * 3 + 1}px;
      height: ${Math.random() * 3 + 1}px;
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
      opacity: ${Math.random() * 0.5 + 0.1};
    `;
        container.appendChild(p);
    }
}
createParticles();

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
    });
});

// Intersection Observer for scroll animations
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -60px 0px' };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card, .step, .testimonial-card, .faq-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ─── NutroVia showcase: secuencia narrativa sincronizada con scroll ───
(function () {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasGsap = window.gsap && window.ScrollTrigger;
    const splash = document.querySelector('#nvSequencePhone .nv-app-view--splash');
    const dashboard = document.querySelector('#nvSequencePhone .nv-app-view--dashboard');
    const sequencePhone = document.getElementById('nvSequencePhone');
    const transitionCard = document.querySelector('.nv-transition-card');
    const phoneStage = document.querySelector('.nv-phone-transition__stage');
    const phoneSection = document.getElementById('nv-phone-transition');
    const conceptPanel = document.getElementById('nv-concept');
    const purposePanel = document.getElementById('nv-purpose');
    const purposeStage = document.querySelector('.nv-purpose-stage');
    const purposeCard = document.querySelector('.nv-purpose-card');
    const purposePhone = document.getElementById('nvPurposePhone');
    const closingPanel = document.getElementById('nv-closing');
    const watchSection = document.getElementById('nv-watch-section');

    const showAppView = (view) => {
        if (!splash || !dashboard) return;
        splash.classList.toggle('nv-app-view--visible', view === 'splash');
        dashboard.classList.toggle('nv-app-view--visible', view === 'dashboard');
    };

    showAppView('splash');

    // Reduced motion keeps every section readable without scroll-driven transforms.
    if (!hasGsap || prefersReduced) {
        document.querySelectorAll('.nv-transition-card').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'none';
        });
        document.querySelectorAll('.nv-wipe-panel, .nv-purpose-stage, .nv-purpose-card, #nvPurposePhone, .nv-watch-section').forEach(el => {
            el.style.transform = 'none';
            el.style.opacity = '1';
            el.style.clipPath = 'none';
        });
        showAppView('dashboard');
        return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const viewport = () => window.innerHeight;

    const triggerOptions = (id, trigger, start, end) => ({
        id,
        trigger,
        start,
        end,
        scrub: 1,
        invalidateOnRefresh: true,
    });

    // Keep trigger elements in normal flow. Panels slide up as a single unit
    // with their content, using translateY for the reveal.
    gsap.set(sequencePhone, { xPercent: -50, yPercent: -50, x: 0, rotationY: 0, rotationZ: 0 });
    gsap.set(transitionCard, { yPercent: -50, x: 22, autoAlpha: 0 });
    gsap.set(conceptPanel, { y: '100vh', scale: 0.85 });
    gsap.set(purposeStage, { yPercent: 50, y: 0, scale: 0.85, borderRadius: 0 });
    gsap.set(purposeCard, { y: 32, autoAlpha: 0 });
    gsap.set(purposePhone, { rotationY: -12, rotationZ: 3, x: 16, autoAlpha: 0 });
    gsap.set(closingPanel, { y: '100vh' });
    gsap.set(watchSection, { y: '100vh' });

    // Master 1: phone content and card, followed by the dark-stage framing.
    const isMobile = window.innerWidth <= 900;
    const phoneX = isMobile ? '-14vw' : '-22vw';
    const phoneRotZ = isMobile ? '-1.5' : '-3';

    const phoneMaster = gsap.timeline({
        scrollTrigger: triggerOptions(
            'nv-phone-master',
            phoneSection,
            'top top',
            () => `+=${Math.max(phoneSection.offsetHeight - viewport(), 1)}`
        ),
    });
    phoneMaster
        .to(sequencePhone, {
            x: phoneX,
            rotationY: 360,
            rotationZ: phoneRotZ,
            duration: 0.62,
            ease: 'none',
            onUpdate() {
                showAppView(this.progress() < 0.88 ? 'splash' : 'dashboard');
            },
        })
        .to(transitionCard, { x: 0, autoAlpha: 1, duration: 0.14, ease: 'none' })
        .to({}, { duration: 0.18 })
        .to(phoneStage, { scale: isMobile ? 0.98 : 0.96, borderRadius: isMobile ? 12 : 18, duration: 0.06, ease: 'none' });

    // Master 2: concept block entrance — pins and grows from compressed,
    // covering the dark section below. After the entrance the pin releases
    // and the block scrolls away normally (no scale/exit animation).
    const conceptMaster = gsap.timeline({
        scrollTrigger: {
            id: 'nv-concept-master',
            trigger: conceptPanel,
            start: 'top top',
            end: () => `+=${Math.max(conceptPanel.offsetHeight - viewport(), 1)}`,
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
        },
    });
    conceptMaster
        .to(conceptPanel, { y: 0, scale: 1, duration: 1, ease: 'none' });

    // Master 3: purpose block entrance — grows from compressed as it
    // enters the viewport, with content fade-in.
    const purposeMaster = gsap.timeline({
        scrollTrigger: triggerOptions(
            'nv-purpose-master',
            purposePanel,
            'top bottom',
            () => 'top top'
        ),
    });
    purposeMaster
        .to(purposeStage, { scale: 1, yPercent: 0, duration: 0.72, ease: 'none' })
        .to(purposeCard, { y: 0, autoAlpha: 1, duration: 0.28, ease: 'none' })
        .to(purposePhone, { rotationY: 8, rotationZ: -2, x: 0, autoAlpha: 1, duration: 0.28, ease: 'none' }, '<');

    // Master 4 starts exactly when the purpose stage has completed its own
    // measured travel. It uses the purpose section as a stable trigger, so the
    // closing card cannot cover purpose content before that content is ready.
    const closingMaster = gsap.timeline({
        scrollTrigger: triggerOptions(
            'nv-closing-master',
            purposePanel,
            'top top',
            () => 'bottom bottom'
        ),
    });
    closingMaster
        .to(closingPanel, { y: 0, duration: 1, ease: 'none' });

    // Master 5: Apple Watch hero section rises as a single unit.
    const watchMaster = gsap.timeline({
        scrollTrigger: triggerOptions(
            'nv-watch-master',
            watchSection,
            'top bottom',
            () => 'top 30%'
        ),
    });
    watchMaster
        .to(watchSection, { y: 0, duration: 1, ease: 'none' });

    const refreshScroll = () => {
        requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    window.addEventListener('load', refreshScroll, { once: true });
    window.addEventListener('resize', refreshScroll);
    document.querySelectorAll('img').forEach(image => image.addEventListener('load', refreshScroll, { once: true }));
    if (document.fonts?.ready) document.fonts.ready.then(refreshScroll);
    refreshScroll();
})();
