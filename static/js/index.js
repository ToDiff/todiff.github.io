/* ============================================================
   Network Security Lab — Shared JavaScript
   - Dynamic navbar (lab vs. project context)
   - Theme toggle (dark/light, localStorage)
   - Page transition (clean fade)
   - Scroll-reveal animations
   - Navbar burger, FAQ
   ============================================================ */

(function () {
  'use strict';

  /* ── Project Registry ───────────────────────────────────
     Each project defines its own tabs.
     Add new projects here — the navbar auto-adapts.
     ─────────────────────────────────────────────────────── */
  var PROJECTS = {
    todiff: {
      name: 'ToDiff',
      tabs: [
        { label: 'Overview', href: 'todiff.html' },
        { label: 'Docs',     href: 'documentation.html' },
        { label: 'Support',  href: 'support.html' }
      ]
    },
    spar: {
      name: 'SPAR',
      tabs: [
        { label: 'Overview', href: 'spar.html' },
        { label: 'Docs',     href: 'spar-docs.html' },
        { label: 'Support',  href: 'spar-support.html' }
      ]
    }
  };

  var LAB_NAV = [
    { label: 'Home',        href: 'index.html' },
    { label: 'Bug Reports', href: 'bugreports.html' },
    { label: 'Team',      href: 'people.html' }
  ];

  /* ── Detect current context ─────────────────────────── */
  function getProjectName() {
    return document.body.getAttribute('data-project') || null;
  }

  function getCurrentPath() {
    var path = window.location.pathname;
    var name = path.substring(path.lastIndexOf('/') + 1);
    return name || 'index.html';
  }

  /* ── Render Navbar ──────────────────────────────────── */
  function renderNavbar() {
    var project = getProjectName();
    var current = getCurrentPath();
    var list = document.getElementById('nav-links');
    if (!list) return;

    var backBtn = document.getElementById('nav-back');
    var logoText = document.getElementById('logo-text');

    if (project && PROJECTS[project]) {
      // ── Project context ──
      var cfg = PROJECTS[project];
      if (backBtn) {
        backBtn.style.display = 'flex';
        backBtn.href='index.html'
      }
      if (logoText) logoText.textContent = cfg.name;
      // Update logo link to project base page
      var logoLink = document.querySelector('.navbar-logo');
      if (logoLink && cfg.tabs[0]) logoLink.href = cfg.tabs[0].href;

      list.innerHTML = '';
      cfg.tabs.forEach(function (tab) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = tab.href;
        a.textContent = tab.label;
        if (current === tab.href) a.classList.add('active');
        li.appendChild(a);
        list.appendChild(li);
      });
    } else {
      // ── Lab context ──
      if (backBtn) backBtn.style.display = 'none';
      if (logoText) logoText.textContent = '';
      var logoLink = document.querySelector('.navbar-logo');
      if (logoLink) logoLink.href = 'index.html';

      list.innerHTML = '';
      LAB_NAV.forEach(function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.label;
        if (current === item.href) a.classList.add('active');
        li.appendChild(a);
        list.appendChild(li);
      });
    }
  }

  /* ── Theme Toggle ───────────────────────────────────── */
  var THEME_KEY = 'cs-lab-theme';

  function getTheme() {
    return (localStorage.getItem(THEME_KEY) === 'light') ? 'light' : 'dark';
  }

  function applyTheme(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    var icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.textContent = (t === 'light') ? '🌙' : '☀️';
  }

  function toggleTheme() {
    var next = (getTheme() === 'dark') ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  /* ── Page Transition (clean fade) ───────────────────── */
  var transitioning = false;

  function getOverlay() {
    var el = document.getElementById('pt-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pt-overlay';
    el.innerHTML = '<div class="pt-spinner"></div>';
    document.body.appendChild(el);
    return el;
  }

  function navigateTo(url) {
    if (transitioning) return;
    transitioning = true;
    var overlay = getOverlay();
    overlay.classList.add('active');

    setTimeout(function () {
      window.location.href = url;
    }, 200);
  }

  function initPageTransitions() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('//') ||
          link.target === '_blank' || link.hasAttribute('download') || href.startsWith('mailto:')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      e.preventDefault();
      navigateTo(href);
    });

    // Fade out overlay on page load
    var overlay = document.getElementById('pt-overlay');
    if (overlay) {
      setTimeout(function () {
        overlay.classList.remove('active');
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);
      }, 80);
    }
  }

  /* ── Scroll Reveal ──────────────────────────────────── */
  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });
  }

  /* ── Navbar Burger ──────────────────────────────────── */
  function initBurger() {
    var burger = document.querySelector('.navbar-burger');
    var menu = document.getElementById('nav-links');
    if (!burger || !menu) return;
    burger.addEventListener('click', function () {
      burger.classList.toggle('is-active');
      menu.classList.toggle('is-active');
    });
  }

  /* ── FAQ ────────────────────────────────────────────── */
  function initFaq() {
    document.querySelectorAll('.faq-question').forEach(function (q) {
      q.addEventListener('click', function () {
        q.classList.toggle('open');
        var a = q.nextElementSibling;
        if (a) a.classList.toggle('hidden');
      });
    });
  }

  /* ── Init ───────────────────────────────────────────── */
  function init() {
    applyTheme(getTheme());
    renderNavbar();
    initBurger();
    initFaq();
    initScrollReveal();
    initPageTransitions();

    var toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.addEventListener('click', toggleTheme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
