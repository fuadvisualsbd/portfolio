/* ===== PRELOADER ===== */
window.addEventListener('load', () => {
  setTimeout(() => document.querySelector('.preloader')?.classList.add('hidden'), 600);
});

/* ===== PARTICLE SYSTEM ===== */
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [], mouse = { x: 0, y: 0 };
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.6;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.4 + 0.15;
    }
    update() {
      const dx = mouse.x - this.x, dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) { this.x -= dx * 0.01; this.y -= dy * 0.01; }
      this.x += this.speedX; this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw(isDark) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      if (isDark) {
        ctx.fillStyle = `rgba(180, 200, 255, ${this.opacity})`;
      } else {
        // 90s vintage slate/navy subtle particles on warm beige
        ctx.fillStyle = `rgba(75, 68, 56, ${this.opacity * 0.85})`;
      }
      ctx.fill();
    }
  }

  for (let i = 0; i < 75; i++) particles.push(new Particle());
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    particles.forEach(p => { p.update(); p.draw(isDark); });
    // Draw connections
    for (let a = 0; a < particles.length; a++) {
      for (let b = a + 1; b < particles.length; b++) {
        const dx = particles[a].x - particles[b].x;
        const dy = particles[a].y - particles[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 115) {
          if (isDark) {
            ctx.strokeStyle = `rgba(124, 92, 252, ${0.08 * (1 - dist / 115)})`;
          } else {
            ctx.strokeStyle = `rgba(0, 0, 128, ${0.08 * (1 - dist / 115)})`;
          }
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ===== CUSTOM CURSOR ===== */
(function initCursor() {
  if (window.innerWidth < 900) return;
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  function updateCursor() {
    dot.style.left = mx - 4 + 'px'; dot.style.top = my - 4 + 'px';
    rx += (mx - rx) * 0.15; ry += (my - ry) * 0.15;
    ring.style.left = rx - 18 + 'px'; ring.style.top = ry - 18 + 'px';
    requestAnimationFrame(updateCursor);
  }
  updateCursor();
  document.querySelectorAll('a, button, .tool-card, .skill-tag, .profile-ring').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
  });
})();

/* ===== NAVBAR SCROLL ===== */
(function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const progress = document.querySelector('.scroll-progress');
  window.addEventListener('scroll', () => {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 50);
    const scrolled = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
    if (progress) progress.style.width = scrolled + '%';
  });
})();

/* ===== SCROLL SPY ===== */
(function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-links a, .mobile-menu a');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => { if (window.pageYOffset >= s.offsetTop - 200) current = s.id; });
    links.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('href') === '#' + current) l.classList.add('active');
    });
  });
})();

/* ===== MOBILE MENU ===== */
(function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (!hamburger || !mobileMenu) return;
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
})();

/* ===== TYPING ANIMATION ===== */
(function initTyping() {
  const el = document.getElementById('typed-text');
  if (!el) return;
  const roles = ['Creative Technology Studio', 'AI & Automation', 'SaaS Development', 'Software Solutions'];
  let roleIndex = 0, charIndex = 0, isDeleting = false;
  function type() {
    const current = roles[roleIndex];
    el.textContent = current.substring(0, charIndex);
    if (!isDeleting) {
      charIndex++;
      if (charIndex > current.length) { isDeleting = true; setTimeout(type, 1500); return; }
    } else {
      charIndex--;
      if (charIndex === 0) { isDeleting = false; roleIndex = (roleIndex + 1) % roles.length; }
    }
    setTimeout(type, isDeleting ? 40 : 80);
  }
  type();
})();

/* ===== SCROLL REVEAL ===== */
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

/* ===== SKILL BAR ANIMATION ===== */
(function initSkillBars() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target.querySelector('.skill-bar-fill');
        if (fill) fill.style.width = fill.dataset.width;
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.skill-bar-item').forEach(el => observer.observe(el));
})();

/* ===== COUNTER ANIMATION ===== */
(function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        let count = 0;
        const step = Math.ceil(target / 40);
        const timer = setInterval(() => {
          count += step;
          if (count >= target) { count = target; clearInterval(timer); }
          el.textContent = count + (el.dataset.suffix || '');
        }, 30);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
})();

/* ===== CARD TILT EFFECT ===== */
(function initTilt() {
  if (window.innerWidth < 900) return;
  document.querySelectorAll('.glass-card, .tool-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();

/* ===== BACK TO TOP ===== */
(function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ===== HERO PROFILE PHOTO & LOGO ANIMATION ===== */
(function initProfileSwap() {
  const photo = document.getElementById('profileImgPhoto');
  const logo = document.getElementById('profileImgLogo');
  const ring = document.getElementById('profileRing');
  if (!photo || !logo || !ring) return;

  let showLogo = false;
  let timer = null;

  function toggle() {
    showLogo = !showLogo;
    if (showLogo) {
      photo.classList.add('is-hidden');
      logo.classList.add('is-visible');
    } else {
      photo.classList.remove('is-hidden');
      logo.classList.remove('is-visible');
    }
  }

  function start() {
    stop();
    timer = setInterval(toggle, 3500);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  ring.addEventListener('click', () => {
    toggle();
    start();
  });

  const parent = ring.closest('.hero-profile') || ring.parentElement;
  if (parent) {
    parent.addEventListener('mouseenter', stop);
    parent.addEventListener('mouseleave', start);
  }

  start();
})();

/* ===== YEAR ===== */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ===== THEME: 90s NOSTALGIC OLD BEIGE ===== */
document.documentElement.setAttribute('data-theme', 'old-beige');
