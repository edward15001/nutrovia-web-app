// ─── NutroVia — main.js (Landing Page Engine) ────────────

document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. Navbar Flotante Glassmorphism con Auto-Hide al Scroll ──
  let lastScrollY = window.scrollY;
  const siteHeader = document.getElementById('siteHeader') || document.querySelector('.site-header');
  const navbar = document.getElementById('navbar') || document.querySelector('.navbar');

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    // Auto-hide: se oculta al bajar y reaparece al subir
    if (currentScrollY > 80 && currentScrollY > lastScrollY) {
      siteHeader?.classList.add('nav--hidden');
    } else {
      siteHeader?.classList.remove('nav--hidden');
    }

    // Efecto de condensación de cristal al avanzar el scroll
    if (currentScrollY > 40) {
      navbar?.classList.add('navbar--scrolled');
    } else {
      navbar?.classList.remove('navbar--scrolled');
    }

    lastScrollY = currentScrollY;
  }, { passive: true });

  // ─── 2. Mobile Drawer Menu (Bocadillo / Hamburguesa Lateral) ──
  const mobileToggle = document.getElementById('navMobileToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const mobileBackdrop = document.getElementById('mobileDrawerBackdrop');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');

  function openDrawer() {
    mobileDrawer?.classList.add('open');
    mobileBackdrop?.classList.add('open');
    mobileToggle?.setAttribute('aria-expanded', 'true');
    mobileDrawer?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    mobileDrawer?.classList.remove('open');
    mobileBackdrop?.classList.remove('open');
    mobileToggle?.setAttribute('aria-expanded', 'false');
    mobileDrawer?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  mobileToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (mobileDrawer?.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  drawerCloseBtn?.addEventListener('click', closeDrawer);
  mobileBackdrop?.addEventListener('click', closeDrawer);

  document.querySelectorAll('.mobile-drawer-actions a').forEach(a => {
    a.addEventListener('click', closeDrawer);
  });

  // ─── 3. Ambient Particles Generator ──────────────────────
  function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 3 + 1.5;
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        width: ${size}px;
        height: ${size}px;
        animation-duration: ${Math.random() * 12 + 8}s;
        animation-delay: ${Math.random() * 8}s;
        opacity: ${Math.random() * 0.4 + 0.1};
      `;
      container.appendChild(p);
    }
  }
  createParticles();

  // ─── 4. FAQ Accordion ────────────────────────────────────
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // ─── 5. FUTURE.CO SCROLL ENGINE (GSAP + ScrollTrigger) ───
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  const sequencePhone = document.getElementById('nvSequencePhone');
  const phoneStage = document.getElementById('nvPhoneStage');
  const cardIntro = document.getElementById('nvCardIntro');
  const phoneSplash = document.getElementById('nvPhoneSplash');
  const phoneDash = document.getElementById('nvPhoneDash');
  const phoneSection = document.getElementById('nv-phone-transition');
  const conceptLayer = document.getElementById('nv-concept');
  const purposeSection = document.getElementById('nv-purpose');
  const purposeCard = document.querySelector('.nv-purpose-card');
  const purposePhone = document.getElementById('nvPurposePhone');
  const watchSection = document.getElementById('nv-watch-section');

  if (!hasGsap || prefersReduced) {
    if (phoneSplash) phoneSplash.style.opacity = '0';
    if (phoneDash) phoneDash.style.opacity = '1';
    if (cardIntro) cardIntro.style.opacity = '1';
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  // ─── DESKTOP TIMELINE (min-width: 901px) ─────────────────
  mm.add("(min-width: 901px)", () => {
    gsap.set(cardIntro, { autoAlpha: 0, x: 60 });
    gsap.set(sequencePhone, { x: 0, scale: 1 });
    gsap.set(phoneSplash, { autoAlpha: 1 });
    gsap.set(phoneDash, { autoAlpha: 0 });

    if (phoneSection && sequencePhone) {
      const phoneTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: phoneSection,
          start: 'top top',
          end: '+=160%',
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true
        }
      });

      phoneTimeline
        .to(sequencePhone, {
          x: -240,
          duration: 0.6,
          ease: 'none'
        })
        .to(phoneSplash, {
          autoAlpha: 0,
          duration: 0.25,
          ease: 'power1.inOut'
        }, '-=0.45')
        .to(phoneDash, {
          autoAlpha: 1,
          duration: 0.35,
          ease: 'power1.inOut'
        }, '-=0.25')
        .to(cardIntro, {
          x: 0,
          autoAlpha: 1,
          duration: 0.35,
          ease: 'power2.out'
        }, '-=0.3')
        .to(phoneStage, {
          scale: 0.92,
          opacity: 0.75,
          duration: 0.4,
          ease: 'power1.in'
        });
    }
  });

  // ─── MOBILE / TABLET TIMELINE (max-width: 900px) ─────────
  mm.add("(max-width: 900px)", () => {
    // En móviles el teléfono se mantiene centrado en x: 0 (nunca se desliza hacia fuera)
    gsap.set(sequencePhone, { x: 0, scale: 1 });
    gsap.set(cardIntro, { autoAlpha: 1, x: 0 });
    gsap.set(phoneSplash, { autoAlpha: 1 });
    gsap.set(phoneDash, { autoAlpha: 0 });

    if (phoneSection && phoneSplash && phoneDash) {
      // Conmutación suave entre pantalla de carga y dashboard al hacer scroll
      gsap.timeline({
        scrollTrigger: {
          trigger: phoneSection,
          start: 'top 30%',
          end: 'top -20%',
          scrub: 1
        }
      })
      .to(phoneSplash, { autoAlpha: 0, duration: 0.3 })
      .to(phoneDash, { autoAlpha: 1, duration: 0.3 }, '-=0.15');
    }
  });

  // ─── TIMELINE 2: Concept Cream Layer Card Stacking ────────
  // Entrada: sube desde abajo cubriendo a la sección oscura anterior como una card.
  // Salida: se desplaza hacia arriba con el scroll natural a tamaño 100%, sin encogimiento ni scale.
  if (conceptLayer) {
    gsap.from(conceptLayer, {
      scrollTrigger: {
        trigger: conceptLayer,
        start: 'top 98%',
        end: 'top 20%',
        scrub: 1
      },
      y: 160,
      opacity: 0.95,
      ease: 'none'
    });
  }

  // ─── TIMELINE 3: Purpose Section (Dark Pinned) ───────────
  if (purposeSection && purposeCard && purposePhone) {
    gsap.set(purposeCard, { autoAlpha: 0, y: 30 });
    gsap.set(purposePhone, { autoAlpha: 0, scale: 0.92, y: 20 });

    const purposeTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: purposeSection,
        start: 'top top',
        end: '+=100%',
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true
      }
    });

    purposeTimeline
      .to(purposeCard, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power1.out' })
      .to(purposePhone, { autoAlpha: 1, scale: 1, y: 0, duration: 0.4, ease: 'power1.out' }, '<')
      .to({}, { duration: 0.3 }); // Hold
  }

  // ─── TIMELINE 4: Apple Watch Mockup Hero Standalone ──────
  if (watchSection) {
    const watchMockup = document.getElementById('nvWatchMockup');
    const watchText = watchSection.querySelector('.nv-watch-text-col');

    if (watchMockup && watchText) {
      gsap.from(watchMockup, {
        scrollTrigger: {
          trigger: watchSection,
          start: 'top 75%',
          end: 'top 35%',
          scrub: 1
        },
        scale: 0.9,
        y: 40,
        opacity: 0.7,
        ease: 'power2.out'
      });

      gsap.from(watchText, {
        scrollTrigger: {
          trigger: watchSection,
          start: 'top 75%',
          end: 'top 35%',
          scrub: 1
        },
        x: 30,
        opacity: 0,
        ease: 'power2.out'
      });
    }
  }

  // ─── 5. Recalcular triggers al cargar imágenes/fuentes ────
  const refreshTriggers = () => {
    ScrollTrigger.refresh();
  };

  window.addEventListener('load', refreshTriggers);
  window.addEventListener('resize', refreshTriggers);
  if (document.fonts?.ready) {
    document.fonts.ready.then(refreshTriggers);
  }
});
