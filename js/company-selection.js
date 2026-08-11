// ============================================================
// Comp Vision - Company Selection Screen
// Tela premium de selecao de empresa com animacoes GSAP
// ============================================================

let particleCanvas = null;
let particleCtx = null;
let particles = [];
let particleAnimId = null;
let mouseX = 0;
let mouseY = 0;

function initParticles() {
  particleCanvas = document.getElementById('companyParticles');
  if (!particleCanvas) return;
  particleCtx = particleCanvas.getContext('2d');
  resizeParticles();
  particles = [];
  const count = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 12000));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2.5 + 1,
      alpha: Math.random() * 0.5 + 0.2,
    });
  }
  animateParticles();
}

function resizeParticles() {
  if (!particleCanvas) return;
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}

function animateParticles() {
  if (!particleCtx || !particleCanvas) return;
  particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > particleCanvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > particleCanvas.height) p.vy *= -1;
    particleCtx.beginPath();
    particleCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    particleCtx.fillStyle = `rgba(245, 197, 27, ${p.alpha})`;
    particleCtx.fill();
  }
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        particleCtx.beginPath();
        particleCtx.moveTo(particles[i].x, particles[i].y);
        particleCtx.lineTo(particles[j].x, particles[j].y);
        particleCtx.strokeStyle = `rgba(245, 197, 27, ${0.08 * (1 - dist / 120)})`;
        particleCtx.lineWidth = 0.5;
        particleCtx.stroke();
      }
    }
  }
  particleAnimId = requestAnimationFrame(animateParticles);
}

function showCompanySelection() {
  const screen = document.getElementById('companySelection');
  if (!screen) return;
  screen.classList.remove('hidden');
  document.getElementById('loginScreen').classList.add('hidden');

  const companies = supabaseManager.getCompanies();
  const grid = document.getElementById('companyGrid');
  grid.innerHTML = companies.map((c, i) => `
    <div class="company-card" data-company-id="${c.id}" data-index="${i}">
      <div class="company-card-glow"></div>
      <div class="company-card-inner">
        <div class="company-card-logo">
          <img src="${c.logo}" alt="${c.name}">
        </div>
        <h3 class="company-card-name">${c.city || c.name}</h3>
        <button class="company-card-btn" data-company-id="${c.id}">
          <span>Entrar</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  // Card 3D tilt effect
  document.querySelectorAll('.company-card').forEach(card => {
    const btn = card.querySelector('.company-card-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onCompanySelect(card.dataset.companyId);
    });
    card.addEventListener('mouseenter', () => {
      card.style.zIndex = '10';
    });
    card.addEventListener('mouseleave', () => {
      card.style.zIndex = '1';
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg)`;
    });
  });

  initParticles();

  // GSAP entrance animations
  if (typeof gsap !== 'undefined') {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('.company-brand', { opacity: 0, y: -20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.3 })
      .fromTo('.company-card', { opacity: 0, y: 30, scale: 0.96 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.06,
        ease: 'back.out(1.2)',
      }, '-=0.1')
      .fromTo('.company-footer', { opacity: 0 }, { opacity: 1, duration: 0.2 }, '-=0.1');
  } else {
    document.querySelectorAll('.company-card').forEach((el, i) => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.transition = 'opacity 0.6s ease, transform 0.6s ease'; el.style.opacity = '1'; }, i * 120);
    });
  }
}

function hideCompanySelection() {
  const screen = document.getElementById('companySelection');
  if (screen) screen.classList.add('hidden');
  if (particleAnimId) cancelAnimationFrame(particleAnimId);
}

function onCompanySelect(companyId) {
  const card = document.querySelector(`.company-card[data-company-id="${companyId}"]`);
  if (!card) return;

  const btn = card.querySelector('.company-card-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="company-card-spinner"></div>';

  if (typeof gsap !== 'undefined') {
    const otherCards = document.querySelectorAll(`.company-card:not([data-company-id="${companyId}"])`);
    gsap.to(otherCards, { opacity: 0, scale: 0.8, y: 40, duration: 0.4, ease: 'power2.in' });
    gsap.to(card, {
      scale: 1.08, duration: 0.3, ease: 'back.out(2)',
      onComplete: () => {
        gsap.to('.company-selection', { opacity: 0, duration: 0.5, delay: 0.1, onComplete: () => finalizeSelection(companyId) });
      },
    });
  } else {
    setTimeout(() => finalizeSelection(companyId), 300);
  }
}

function finalizeSelection(companyId) {
  const ok = supabaseManager.switchCompany(companyId);
  if (!ok) {
    showNotification('Erro ao conectar com a empresa selecionada', 'error');
    showCompanySelection();
    return;
  }
  usingSupabase = true;
  updateLoginBranding();
  document.getElementById('loginScreen').classList.remove('hidden');
  hideCompanySelection();
  if (typeof gsap !== 'undefined') {
    gsap.fromTo('.login-container', { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' });
  }
  lucide.createIcons();
}

function goBackToCompanySelection() {
  location.reload();
}

window.addEventListener('resize', resizeParticles);
