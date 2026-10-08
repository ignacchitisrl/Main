/* =========================================================
   IGNACCHITI FRANCESCO S.R.L. — interazioni
   Vanilla JS: IntersectionObserver + un solo loop rAF su scroll
   ========================================================= */
(function () {
  'use strict';

  var d = document, w = window, root = d.documentElement;
  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mqWide = w.matchMedia('(min-width: 1024px)');
  var mqHS = w.matchMedia('(min-width: 900px) and (min-height: 560px)');

  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- 1. Titoli parola per parola ---------- */
  function splitWords(node, counter) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = d.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(' ')); return; }
          var outer = d.createElement('span'); outer.className = 'w';
          var inner = d.createElement('span'); inner.textContent = part;
          inner.style.setProperty('--i', counter.n++);
          outer.appendChild(inner); frag.appendChild(outer);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') {
        splitWords(n, counter);
      }
    });
  }
  if (!reduce) {
    $$('[data-split]').forEach(function (el) { splitWords(el, { n: 0 }); });
  }

  /* ---------- 2. Stagger automatico ---------- */
  $$('[data-stagger]').forEach(function (parent) {
    var step = parseInt(parent.getAttribute('data-stagger'), 10) || 90;
    var i = 0;
    Array.prototype.slice.call(parent.children).forEach(function (child) {
      if (child.hasAttribute('data-reveal')) { child.style.setProperty('--d', (i * step) + 'ms'); i++; }
    });
  });

  /* ---------- 3. Contatori ---------- */
  var counters = $$('[data-count]');
  function runCounter(el) {
    if (el.__done) return; el.__done = true;
    var to = parseInt(el.getAttribute('data-count'), 10);
    var from = parseInt(el.getAttribute('data-from') || '0', 10);
    if (reduce) { el.textContent = to; return; }
    var dur = 1700, t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = clamp((t - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = to;
    }
    requestAnimationFrame(step);
  }
  if (!reduce) counters.forEach(function (el) { el.textContent = el.getAttribute('data-from') || '0'; });

  /* ---------- 4. Reveal ---------- */
  function show(el) {
    el.classList.add('in');
    $$('[data-count]', el).forEach(runCounter);
    if (el.hasAttribute('data-count')) runCounter(el);
  }
  var io = null;
  if ('IntersectionObserver' in w) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    // gli elementi con clip-path iniziale non risultano mai "visibili" all'observer:
    // si osserva il contenitore e si rivela l'elemento quando questo entra in viewport
    var proxy = new Map();
    $$('[data-reveal], [data-split], .eyebrow').forEach(function (el) {
      if (el.hasAttribute('data-hero')) return;
      if (el.closest('.hero')) return;
      if (el.getAttribute('data-reveal') === 'clip') {
        var host = el.parentElement;
        if (!proxy.has(host)) { proxy.set(host, []); }
        proxy.get(host).push(el);
        return;
      }
      io.observe(el);
    });
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { (proxy.get(e.target) || []).forEach(show); io2.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    proxy.forEach(function (_, host) { io2.observe(host); });
  } else {
    $$('[data-reveal], [data-split], .eyebrow').forEach(show);
  }

  /* ---------- 5. Preloader ---------- */
  var pl = $('#preloader');
  var started = performance.now();
  var seen = false;
  try { seen = w.sessionStorage.getItem('if_seen') === '1'; w.sessionStorage.setItem('if_seen', '1'); } catch (e) {}

  function revealHero() {
    $$('[data-hero]').forEach(show);
  }
  function finishLoading() {
    root.classList.remove('loading');
    root.classList.add('is-ready');
    if (pl) {
      pl.classList.add('done');
      setTimeout(function () { if (pl && pl.parentNode) pl.parentNode.removeChild(pl); }, 1300);
    }
    revealHero();
    update();
  }
  if (reduce || !pl) {
    if (pl) pl.parentNode.removeChild(pl);
    root.classList.add('is-ready');
    revealHero();
  } else {
    root.classList.add('loading');
    if (seen) pl.classList.add('quick');
    var minTime = seen ? 450 : 1900;
    var loaded = new Promise(function (res) {
      if (d.readyState === 'complete') res(); else w.addEventListener('load', res);
    });
    var fonts = (d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve();
    var cap = new Promise(function (res) { setTimeout(res, 3500); });
    Promise.race([Promise.all([loaded, fonts]), cap]).then(function () {
      var wait = Math.max(0, minTime - (performance.now() - started));
      setTimeout(finishLoading, wait);
    });
  }

  /* ---------- 6. Header, menu, sezione attiva ---------- */
  var header = $('#header');
  var progress = $('#progress');
  var toggle = $('#navToggle');
  var menu = $('#menu');
  var menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle('open', open);
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) { menu.removeAttribute('inert'); var first = $('.menu-list a', menu); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 500); }
    else { menu.setAttribute('inert', ''); }
  }
  toggle.addEventListener('click', function () { setMenu(!menuOpen); if (!menuOpen) toggle.focus(); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { setMenu(false); toggle.focus(); } });
  var mqDesktopNav = w.matchMedia('(min-width: 981px)');
  var onNavMq = function (e) { if (e.matches && menuOpen) setMenu(false); };
  if (mqDesktopNav.addEventListener) mqDesktopNav.addEventListener('change', onNavMq);

  // sezione attiva
  var navLinks = $$('.main-nav a');
  function setActive(id) {
    navLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-link') === id); });
  }
  if ('IntersectionObserver' in w) {
    var sectionIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var s = e.target;
          var id = s.getAttribute('data-nav') || s.id;
          setActive(id === 'hero' ? '' : id);
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    $$('[data-section]').forEach(function (s) { sectionIO.observe(s); });
  }

  /* ---------- 7. Timeline orizzontale (Storia) ---------- */
  var storia = $('#storia');
  var track = $('#storiaTrack');
  var fill = $('#storiaFill');
  var hsFigs = $$('[data-hsfig]');
  var hsOn = false, hsDist = 0;

  function layoutHS() {
    var want = !reduce && mqHS.matches;
    if (!want) {
      if (hsOn) {
        hsOn = false; storia.classList.remove('hs-on'); storia.style.height = '';
        track.style.transform = ''; fill.style.transform = '';
        hsFigs.forEach(function (f) { f.style.removeProperty('--t'); var im = $('img', f); im.style.transform = ''; });
      }
      return;
    }
    storia.classList.add('hs-on'); hsOn = true;
    hsDist = Math.max(0, track.scrollWidth - w.innerWidth);
    storia.style.height = (hsDist + w.innerHeight) + 'px';
  }

  function updateHS() {
    if (!hsOn) return;
    var r = storia.getBoundingClientRect();
    var total = storia.offsetHeight - w.innerHeight;
    var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    track.style.transform = 'translate3d(' + (-p * hsDist).toFixed(1) + 'px,0,0)';
    fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    var vw = w.innerWidth;
    hsFigs.forEach(function (f) {
      var fr = f.getBoundingClientRect();
      var t = clamp((vw - fr.left) / (vw * 0.55), 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      f.style.setProperty('--t', e.toFixed(3));
      var offset = ((fr.left + fr.width / 2) - vw / 2) / vw;
      $('img', f).style.transform = 'translate3d(' + (-offset * fr.width * 0.18).toFixed(1) + 'px,0,0)';
    });
  }

  /* ---------- 8. Parallax ---------- */
  var heroImg = $('#heroImg');
  var heroSec = $('#hero');
  var parallaxEls = $$('[data-parallax]');

  function updateParallax() {
    var vh = w.innerHeight;
    parallaxEls.forEach(function (el) {
      var host = el.parentElement;
      var r = host.getBoundingClientRect();
      if (r.bottom < -150 || r.top > vh + 150) return;
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      var c = (r.top + r.height / 2) - vh / 2;
      var max = el.tagName === 'IMG' ? r.height * 0.08 : 9999;
      el.style.transform = 'translate3d(0,' + clamp(-c * speed, -max, max).toFixed(1) + 'px,0)';
    });
  }

  /* ---------- 9. Loop scroll ---------- */
  var ticking = false;
  function update() {
    ticking = false;
    var y = w.pageYOffset || root.scrollTop;
    var vh = w.innerHeight;
    var docH = root.scrollHeight - vh;

    header.classList.toggle('scrolled', y > 40);
    if (progress && docH > 0) progress.style.transform = 'scaleX(' + clamp(y / docH, 0, 1).toFixed(4) + ')';

    if (!reduce) {
      if (heroImg && y < vh * 1.3) heroImg.style.transform = 'translate3d(0,' + (y * 0.2).toFixed(1) + 'px,0)';
      updateParallax();
      updateHS();
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  w.addEventListener('scroll', onScroll, { passive: true });

  var resizeT;
  w.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { layoutHS(); update(); }, 120);
  });
  w.addEventListener('load', function () { layoutHS(); update(); });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { layoutHS(); update(); });
  layoutHS();
  update();

  /* ---------- 10. Cursore + pulsanti magnetici ---------- */
  if (finePointer && mqWide.matches && !reduce) {
    var cur = $('#cursor');
    root.classList.add('has-cursor');
    var tx = -100, ty = -100, cx = -100, cy = -100, shown = false;
    d.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; cx = tx; cy = ty; cur.classList.add('on'); }
    }, { passive: true });
    d.documentElement.addEventListener('mouseleave', function () { cur.classList.remove('on'); shown = false; });
    (function loop() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
    d.addEventListener('mouseover', function (e) {
      var t = e.target;
      var link = t.closest && t.closest('a, button, input, select, textarea, label');
      var view = !link && t.closest && t.closest('.sp-fig, .mezzi-fig, .svc, .manifesto');
      cur.classList.toggle('is-link', !!link);
      cur.classList.toggle('is-view', !!view);
    });

    $$('[data-magnetic]').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.setProperty('--mx', ((e.clientX - (r.left + r.width / 2)) * 0.18).toFixed(1) + 'px');
        b.style.setProperty('--my', ((e.clientY - (r.top + r.height / 2)) * 0.3).toFixed(1) + 'px');
      });
      b.addEventListener('mouseleave', function () {
        b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px');
      });
    });
  }

  /* ---------- 11. Form candidatura (comportamento originale: mailto) ---------- */
  var form = d.getElementById('jobForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nome = d.getElementById('jf-nome').value;
      var cognome = d.getElementById('jf-cognome').value;
      var email = d.getElementById('jf-email').value;
      var telefono = d.getElementById('jf-telefono').value;
      var ruolo = d.getElementById('jf-ruolo').value;
      var messaggio = d.getElementById('jf-messaggio').value;

      var subject = 'Candidatura - ' + ruolo + ' - ' + nome + ' ' + cognome;
      var body =
        'Nome: ' + nome + '\n' +
        'Cognome: ' + cognome + '\n' +
        'Email: ' + email + '\n' +
        'Telefono: ' + telefono + '\n' +
        'Posizione: ' + ruolo + '\n\n' +
        'Presentazione:\n' + messaggio + '\n\n' +
        '(Ricordati di allegare il curriculum vitae a questa email prima di inviarla)';

      var mailto = 'mailto:ignacchitisrl@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      w.location.href = mailto;
    });
  }
})();
