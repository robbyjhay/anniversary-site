// js/main.js
document.addEventListener('DOMContentLoaded', () => {
  // --- flipbook controls (index.html) ---
  const startBtn = document.getElementById('startBtn');
  const intro = document.getElementById('intro');
  const flipbook = document.getElementById('flipbook');
  const revealSiteBtn = document.getElementById('revealSiteBtn');

  const show = el => { if(!el) return; el.classList.remove('hidden'); el.style.opacity = 1; }
  const hide = el => { if(!el) return; el.classList.add('hidden'); el.style.opacity = 0; }

  function launchDecorations() {
    try { confetti({ particleCount: 120, spread: 90, origin: { y: 1 } }); } catch(e) {}
  }

  function flipAnimation(fromEl, toEl) {
    if (!fromEl || !toEl) return;
    if (typeof gsap !== 'undefined') {
      gsap.to(fromEl, { rotationY: -90, duration: 0.35, ease: "power1.in", onComplete() {
        hide(fromEl);
        show(toEl);
        gsap.fromTo(toEl, { rotationY: 90 }, { rotationY: 0, duration:0.35, ease:"power1.out" });
      }});
    } else {
      hide(fromEl); show(toEl);
    }
  }

  startBtn?.addEventListener('click', () => {
    launchDecorations();
    if (typeof gsap !== 'undefined') {
      gsap.to(intro, { opacity: 0, duration: 0.8, onComplete() { hide(intro); show(flipbook); }});
    } else {
      hide(intro); show(flipbook);
    }
  });

  document.querySelectorAll('.next-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = btn.closest('.page');
      const nextId = btn.dataset.next;
      const next = document.getElementById(nextId);
      flipAnimation(current, next);
    });
  });

  revealSiteBtn?.addEventListener('click', () => {
    // final: go to full-site.html
    window.location.href = 'full-site.html';
  });

  // --- gallery: lightbox, search, view toggle ---
  const galleryGrid = document.getElementById('galleryGrid');
  if (galleryGrid) {
    const items = Array.from(galleryGrid.querySelectorAll('.gallery-item'));
    const lightbox = document.getElementById('lightbox');
    const lbContent = lightbox.querySelector('.lb-content');
    const lbClose = document.querySelector('.lb-close');
    const lbNext = document.querySelector('.lb-next');
    const lbPrev = document.querySelector('.lb-prev');
    let idx = -1;

    function openLightbox(i) {
      const it = items[i];
      if (!it) return;
      idx = i;
      lbContent.innerHTML = '';
      const img = it.querySelector('img');
      const vid = it.querySelector('video');
      if (img) {
        const clone = document.createElement('img');
        clone.src = img.src;
        lbContent.appendChild(clone);
      } else if (vid) {
        const clone = document.createElement('video');
        clone.src = vid.src;
        clone.controls = true;
        clone.autoplay = true;
        lbContent.appendChild(clone);
      }
      lightbox.classList.remove('hidden');
      lightbox.setAttribute('aria-hidden','false');
    }
    function closeLightbox() {
      lightbox.classList.add('hidden');
      lightbox.setAttribute('aria-hidden','true');
      lbContent.innerHTML = '';
    }
    function next() { openLightbox((idx + 1) % items.length); }
    function prev() { openLightbox((idx - 1 + items.length) % items.length); }

    items.forEach((it, i) => it.addEventListener('click', () => openLightbox(i)));
    lbClose?.addEventListener('click', closeLightbox);
    lbNext?.addEventListener('click', next);
    lbPrev?.addEventListener('click', prev);
    document.addEventListener('keydown', (e) => {
      if (lightbox && !lightbox.classList.contains('hidden')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') next();
        if (e.key === 'ArrowLeft') prev();
      }
    });

    // search
    const search = document.getElementById('searchInput');
    if (search) {
      search.addEventListener('input', e => {
        const v = e.target.value.toLowerCase();
        items.forEach(it => {
          const title = (it.dataset.title || '').toLowerCase();
          const tags = (it.dataset.tags || '').toLowerCase();
          if (!v || title.includes(v) || tags.includes(v)) it.style.display = '';
          else it.style.display = 'none';
        });
      });
    }

    // view toggle (masonry vs grid)
    const viewSelect = document.getElementById('viewSelect');
    viewSelect?.addEventListener('change', (e) => {
      if (e.target.value === 'grid') {
        galleryGrid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(200px,1fr))';
      } else {
        galleryGrid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(240px,1fr))';
      }
    });
  }

  // --- simple modal fallback for stories (main logic) ---
  document.addEventListener('click', (e) => {
    // open story
    const sc = e.target.closest('.story-card');
    if (sc && sc.dataset.target) {
      const id = sc.dataset.target;
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
      return;
    }
    // close
    const close = e.target.closest('.close');
    if (close && close.dataset.target) {
      const id = close.dataset.target;
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
      return;
    }
    // clicking modal outside content closes
    if (e.target.classList && e.target.classList.contains('modal')) {
      e.target.classList.add('hidden');
    }
  });

  // --- subtle hub animation ---
  const hubNav = document.querySelector('.hub-nav');
  if (hubNav && typeof gsap !== 'undefined') {
    gsap.from('.hub-nav .card', { y: 20, opacity: 0, stagger: 0.08, duration: 0.6, ease: 'power2.out' });
  }
});

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('intro').classList.add('hidden');
  const flipbook = document.getElementById('flipbook');
  flipbook.classList.remove('hidden');
  setTimeout(() => flipbook.classList.add('show'), 10);
});
