/* ── Scroll Progress Bar ── */
(function () {
  var bar = document.querySelector('.scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0%';
  }, { passive: true });
})();

/* ── Back-to-Top Button ── */
(function () {
  var btn = document.querySelector('.back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', function () {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ── Fade-in on Scroll (Intersection Observer) ── */
(function () {
  var els = document.querySelectorAll('.fade-in');
  if (!els.length) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(function (el) { observer.observe(el); });
})();
/* ── Hamburger Menü ── */
(function () {
  // Her sayfada çalışsın diye header'a dinamik ekle
  var navWrapper = document.querySelector('.nav-wrapper');
  if (!navWrapper) return;

  var navUl = navWrapper.querySelector('nav ul');
  if (!navUl) return;

  // Overlay oluştur
  var overlay = document.createElement('div');
  overlay.className = 'nav-mobile-overlay';
  document.body.appendChild(overlay);

  // Hamburger butonu oluştur
  var btn = document.createElement('button');
  btn.className = 'hamburger';
  btn.setAttribute('aria-label', 'Menüyü aç');
  btn.innerHTML = '<span></span><span></span><span></span>';
  navWrapper.appendChild(btn);

  function openMenu() {
    navUl.classList.add('mobile-open');
    overlay.classList.add('open');
    btn.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    navUl.classList.remove('mobile-open');
    overlay.classList.remove('open');
    btn.classList.remove('open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', function () {
    navUl.classList.contains('mobile-open') ? closeMenu() : openMenu();
  });

  overlay.addEventListener('click', closeMenu);

  // ESC ile kapat
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  // Link tıklanınca kapat
  navUl.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });
})();
