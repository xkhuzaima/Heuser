/* =====================================================================
   Portfolio OS: window manager, Dock, desktop and the apps inside it.
   Plain JavaScript, no libraries.
   ===================================================================== */
'use strict';

(function () {
  /* ---------- Helpers ---------- */
  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const root = document.documentElement;

  // localStorage can throw (private mode, blocked cookies), so every access is wrapped.
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('portfolio-os:' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('portfolio-os:' + key, JSON.stringify(value)); } catch (e) { /* not saved */ }
    }
  };
  const session = {
    get(key) { try { return sessionStorage.getItem('portfolio-os:' + key); } catch (e) { return null; } },
    set(key, value) { try { sessionStorage.setItem('portfolio-os:' + key, value); } catch (e) { /* not saved */ } }
  };

  const media = {
    reduce: matchMedia('(prefers-reduced-motion: reduce)'),
    light: matchMedia('(prefers-color-scheme: light)'),
    compact: matchMedia('(max-width: 760px)')
  };
  const isCompact = () => media.compact.matches;

  /* ---------- App registry: name shown in the menu bar + default size ---------- */
  const APPS = {
    welcome:      { name: 'Portfolio OS',    w: 520, h: 700 },
    photos:       { name: 'Photos',          w: 820, h: 560 },
    finder:       { name: 'Finder',          w: 900, h: 560 },
    safari:       { name: 'Safari',          w: 820, h: 640 },
    notes:        { name: 'Notes',           w: 780, h: 520 },
    achievements: { name: 'Achievements',    w: 800, h: 690 },
    settings:     { name: 'System Settings', w: 720, h: 540 },
    trash:        { name: 'Trash',           w: 560, h: 400 }
  };

  /* =====================================================================
     SETTINGS (theme, accent, wallpaper, Dock, motion), saved locally
     ===================================================================== */
  const DEFAULTS = { theme: 'dark', accent: 'coral', wallpaper: 'aurora', dockSize: 54, magnify: true, reduceMotion: false };
  const THEMES = ['light', 'dark', 'auto'];
  const ACCENTS = { coral: 'Coral', violet: 'Violet', teal: 'Teal', gold: 'Gold' };
  const WALLPAPERS = ['aurora', 'sunset', 'lagoon', 'midnight'];

  let settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  if (!THEMES.includes(settings.theme)) settings.theme = DEFAULTS.theme;
  if (!ACCENTS[settings.accent]) settings.accent = DEFAULTS.accent;
  if (!WALLPAPERS.includes(settings.wallpaper)) settings.wallpaper = DEFAULTS.wallpaper;
  settings.dockSize = clamp(Number(settings.dockSize) || DEFAULTS.dockSize, 42, 68);

  const reduceMotion = () => settings.reduceMotion || media.reduce.matches;

  function applySettings() {
    const theme = settings.theme === 'auto' ? (media.light.matches ? 'light' : 'dark') : settings.theme;
    root.dataset.theme = theme;
    root.dataset.accent = settings.accent;
    root.dataset.wallpaper = settings.wallpaper;
    root.style.setProperty('--dock-size-user', settings.dockSize + 'px');
    root.classList.toggle('reduce-motion', reduceMotion());
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f3eee8' : '#120d1f';
    syncSettingsUI();
  }

  function saveSettings(animateTheme) {
    store.set('settings', settings);
    if (animateTheme && !reduceMotion()) {
      root.classList.add('theme-anim');
      clearTimeout(saveSettings.t);
      saveSettings.t = setTimeout(() => root.classList.remove('theme-anim'), 600);
    }
    applySettings();
  }

  function swapWallpaper() {
    const wp = $('.wallpaper');
    wp.classList.remove('swap');
    void wp.offsetWidth; // restart the fade-in animation
    wp.classList.add('swap');
  }

  function syncSettingsUI() {
    $$('input[name="theme"]').forEach(r => { r.checked = r.value === settings.theme; });
    $$('input[name="accent"]').forEach(r => { r.checked = r.value === settings.accent; });
    $$('input[name="wallpaper"]').forEach(r => { r.checked = r.value === settings.wallpaper; });
    $('#accent-name').textContent = ACCENTS[settings.accent];
    $('#dock-size').value = settings.dockSize;
    $('#magnify').checked = settings.magnify;
    $('#reduce-motion').checked = settings.reduceMotion;
  }

  applySettings();

  /* =====================================================================
     WINDOW MANAGER
     ===================================================================== */
  const dock = $('#dock');
  const menubar = $('#menubar');
  const mbApp = $('#mb-app');
  const state = {};
  let zTop = 20;
  let cascade = 0;

  const winEl = id => document.getElementById('win-' + id);
  const dockItem = id => dock.querySelector('.dock-item[data-app="' + id + '"]');
  const S = id => state[id] || (state[id] = { open: false, minimized: false, maximized: false, placed: false, prev: null });

  // The free area between the menu bar and the Dock.
  function workArea() {
    const top = menubar.offsetHeight + 8;
    const dockTop = dock.getBoundingClientRect().top;
    return { left: 8, top: top, right: innerWidth - 8, bottom: Math.max(top + 220, dockTop - 10) };
  }

  function getRect(w) {
    return {
      left: parseFloat(w.style.left) || 0,
      top: parseFloat(w.style.top) || 0,
      width: parseFloat(w.style.width) || w.offsetWidth,
      height: parseFloat(w.style.height) || w.offsetHeight
    };
  }

  function setRect(w, r) {
    w.style.left = Math.round(r.left) + 'px';
    w.style.top = Math.round(r.top) + 'px';
    w.style.width = Math.round(r.width) + 'px';
    w.style.height = Math.round(r.height) + 'px';
  }

  function fullRect() {
    const a = workArea();
    return { left: a.left, top: a.top, width: a.right - a.left, height: a.bottom - a.top };
  }

  // Pick a starting position: centred, with a cascade so windows don't stack exactly.
  function place(id) {
    const w = winEl(id);
    const s = S(id);
    s.placed = true;
    if (isCompact()) {
      s.compactPlaced = true;
      setRect(w, fullRect());
      return;
    }
    s.compactPlaced = false;
    const a = workArea();
    const availW = a.right - a.left;
    const availH = a.bottom - a.top;
    const width = Math.min(APPS[id].w, availW);
    const height = Math.min(APPS[id].h, availH);
    const step = cascade++ % 5;
    const left = a.left + (availW - width) / 2 - 60 + step * 30;
    const top = a.top + (availH - height) / 2 - 30 + step * 24;
    setRect(w, {
      width: width,
      height: height,
      left: clamp(left, a.left, a.right - width),
      top: clamp(top, a.top, a.bottom - height)
    });
  }

  // Run a Web Animation on a window, cancelling any animation already running on it.
  function animate(w, frames, options, done) {
    if (w._anim) w._anim.cancel();
    const anim = w.animate(frames, options);
    w._anim = anim;
    anim.onfinish = () => { w._anim = null; if (done) done(); };
    return anim;
  }

  // Distance from the window's centre to its Dock icon's centre.
  function deltaToDock(w, id) {
    const item = dockItem(id);
    const wr = w.getBoundingClientRect();
    const tr = item ? item.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight, width: 0, height: 0 };
    return {
      dx: tr.left + tr.width / 2 - (wr.left + wr.width / 2),
      dy: tr.top + tr.height / 2 - (wr.top + wr.height / 2)
    };
  }

  function focusApp(id, moveFocus) {
    const w = winEl(id);
    if (!(w.classList.contains('focused') && Number(w.style.zIndex) === zTop)) {
      $$('.window').forEach(x => x.classList.toggle('focused', x === w));
      w.style.zIndex = ++zTop;
    }
    mbApp.textContent = APPS[id].name;
    if (moveFocus && !w.contains(document.activeElement)) w.focus({ preventScroll: true });
  }

  // After a close or minimise, focus whichever window is now on top.
  function focusTopmost() {
    const open = $$('.window').filter(x => !x.hidden && !S(x.dataset.app).minimized && S(x.dataset.app).open);
    if (!open.length) {
      $$('.window').forEach(x => x.classList.remove('focused'));
      mbApp.textContent = 'Finder';
      return;
    }
    open.sort((a, b) => (Number(b.style.zIndex) || 0) - (Number(a.style.zIndex) || 0));
    focusApp(open[0].dataset.app, false);
  }

  function bounce(item) {
    if (!item || reduceMotion()) return;
    item.classList.remove('bounce');
    void item.offsetWidth;
    item.classList.add('bounce');
    clearTimeout(item._bounceT);
    item._bounceT = setTimeout(() => item.classList.remove('bounce'), 1100);
  }

  function openApp(id) {
    if (!APPS[id]) return;
    const w = winEl(id);
    const s = S(id);
    closeMenus();

    if (s.open && !s.minimized) { focusApp(id, true); return; }

    const restoring = s.minimized;
    if (!s.placed || (isCompact() && !s.maximized)) place(id);
    w.hidden = false;
    s.open = true;
    s.minimized = false;
    focusApp(id, true);

    const item = dockItem(id);
    if (item) item.classList.add('running');
    if (!restoring) bounce(item);

    if (!reduceMotion()) {
      const d = deltaToDock(w, id);
      const from = restoring
        ? { transform: 'translate(' + d.dx + 'px,' + d.dy + 'px) scale(.06)', opacity: 0 }
        : { transform: 'translate(' + d.dx * 0.22 + 'px,' + d.dy * 0.22 + 'px) scale(.62)', opacity: 0 };
      animate(w, [from, { transform: 'none', opacity: 1 }], { duration: restoring ? 460 : 440, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    if (APP_HOOKS[id]) APP_HOOKS[id]();
  }

  function closeApp(id) {
    const w = winEl(id);
    const s = S(id);
    if (!s.open) return;
    s.open = false;
    s.minimized = false;
    const item = dockItem(id);
    if (item) item.classList.remove('running');
    const done = () => { w.hidden = true; focusTopmost(); };
    if (reduceMotion() || w.hidden) { if (w._anim) w._anim.cancel(); done(); return; }
    animate(w, [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'scale(.93)' }
    ], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)' }, done);
  }

  // A simple "genie" effect: squash, then shrink into the Dock icon.
  function minimizeApp(id) {
    const w = winEl(id);
    const s = S(id);
    if (!s.open || s.minimized) return;
    s.minimized = true;
    const done = () => { w.hidden = true; focusTopmost(); };
    if (reduceMotion()) { done(); return; }
    const d = deltaToDock(w, id);
    animate(w, [
      { transform: 'none', opacity: 1 },
      { transform: 'translate(' + d.dx * 0.3 + 'px,' + d.dy * 0.55 + 'px) scale(.6,.42)', opacity: 0.92, offset: 0.5 },
      { transform: 'translate(' + d.dx + 'px,' + d.dy + 'px) scale(.05)', opacity: 0 }
    ], { duration: 480, easing: 'cubic-bezier(.55,0,.75,.2)' }, done);
  }

  function toggleMaximize(id) {
    if (isCompact()) return;
    const w = winEl(id);
    const s = S(id);
    w.classList.add('geom');
    if (!s.maximized) {
      s.prev = getRect(w);
      setRect(w, fullRect());
      s.maximized = true;
    } else {
      setRect(w, s.prev || fullRect());
      s.maximized = false;
    }
    w.classList.toggle('maximized', s.maximized);
    clearTimeout(w._geomT);
    w._geomT = setTimeout(() => w.classList.remove('geom'), 450);
    focusApp(id, false);
  }

  function initWindow(w) {
    const id = w.dataset.app;
    const bar = $('.titlebar', w);
    const grip = $('.grip', w);

    // Name the traffic-light buttons after their app for screen readers.
    $$('.tl', w).forEach(b => b.setAttribute('aria-label', b.getAttribute('aria-label') + ' ' + APPS[id].name));

    // Traffic lights
    $('.traffic', w).addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();
      if (btn.dataset.action === 'close') closeApp(id);
      else if (btn.dataset.action === 'minimize') minimizeApp(id);
      else toggleMaximize(id);
    });

    // Clicking or tabbing into a window brings it to the front.
    w.addEventListener('pointerdown', () => focusApp(id, false), true);
    w.addEventListener('focusin', () => focusApp(id, false));

    // Drag by the title bar
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button, a, input, .address')) return;
      if (isCompact()) return;
      const s = S(id);
      const startX = e.clientX;
      const startY = e.clientY;
      let rect = getRect(w);
      let moved = false;
      try { bar.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }

      const onMove = ev => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved) {
          if (Math.hypot(dx, dy) < 3) return;
          moved = true;
          w.classList.add('dragging');
          // Dragging a zoomed window pops it back to its old size under the cursor.
          if (s.maximized && s.prev) {
            const ratio = (startX - rect.left) / rect.width;
            rect = { left: startX - s.prev.width * ratio, top: rect.top, width: s.prev.width, height: s.prev.height };
            setRect(w, rect);
            s.maximized = false;
            w.classList.remove('maximized');
          }
        }
        const a = workArea();
        w.style.left = clamp(rect.left + dx, 120 - rect.width, innerWidth - 120) + 'px';
        w.style.top = clamp(rect.top + dy, a.top - 8, innerHeight - 90) + 'px';
      };
      const onUp = () => {
        bar.removeEventListener('pointermove', onMove);
        bar.removeEventListener('pointerup', onUp);
        bar.removeEventListener('pointercancel', onUp);
        w.classList.remove('dragging');
      };
      bar.addEventListener('pointermove', onMove);
      bar.addEventListener('pointerup', onUp);
      bar.addEventListener('pointercancel', onUp);
    });

    // Double-click the title bar to zoom (like macOS)
    bar.addEventListener('dblclick', e => {
      if (e.target.closest('button, a, input, .address')) return;
      toggleMaximize(id);
    });

    // Resize from the bottom-right corner
    grip.addEventListener('pointerdown', e => {
      if (e.button !== 0 || isCompact()) return;
      e.preventDefault();
      e.stopPropagation();
      const s = S(id);
      const start = getRect(w);
      const sx = e.clientX;
      const sy = e.clientY;
      if (s.maximized) { s.maximized = false; w.classList.remove('maximized'); }
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      w.classList.add('dragging');
      const onMove = ev => {
        w.style.width = clamp(start.width + ev.clientX - sx, 320, innerWidth - start.left - 4) + 'px';
        w.style.height = clamp(start.height + ev.clientY - sy, 240, innerHeight - start.top - 4) + 'px';
      };
      const onUp = () => {
        grip.removeEventListener('pointermove', onMove);
        grip.removeEventListener('pointerup', onUp);
        grip.removeEventListener('pointercancel', onUp);
        w.classList.remove('dragging');
      };
      grip.addEventListener('pointermove', onMove);
      grip.addEventListener('pointerup', onUp);
      grip.addEventListener('pointercancel', onUp);
    });
  }

  $$('.window').forEach(initWindow);

  // Keep windows on screen when the browser is resized.
  function refit() {
    Object.keys(APPS).forEach(id => {
      const s = S(id);
      const w = winEl(id);
      if (!s.placed) return;
      if (isCompact()) {
        if (s.open) { setRect(w, fullRect()); s.compactPlaced = true; } else s.placed = false;
        return;
      }
      if (s.compactPlaced) { place(id); return; }
      if (s.maximized) { setRect(w, fullRect()); return; }
      const a = workArea();
      const r = getRect(w);
      const width = Math.min(r.width, a.right - a.left);
      const height = Math.min(r.height, a.bottom - a.top);
      setRect(w, {
        width: width,
        height: height,
        left: clamp(r.left, a.left, a.right - width),
        top: clamp(r.top, a.top, a.bottom - height)
      });
    });
  }

  let resizeTimer = 0;
  addEventListener('resize', () => {
    closeMenus();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { refit(); resizeSparkles(); }, 80);
  });

  /* =====================================================================
     DOCK: open / focus / minimise apps, plus hover magnification
     ===================================================================== */
  const dockItems = $$('.dock-item', dock);

  dock.addEventListener('click', e => {
    const item = e.target.closest('.dock-item');
    if (!item) return;
    const id = item.dataset.app;
    const s = S(id);
    // Clicking the icon of the window you're already using minimises it.
    if (s.open && !s.minimized && winEl(id).classList.contains('focused')) minimizeApp(id);
    else openApp(id);
  });

  let restCenters = null;
  let restSize = 54;
  let mouseX = 0;
  let magRaf = 0;

  dock.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse' || !settings.magnify || isCompact() || reduceMotion()) return;
    restSize = dockItems[0].offsetWidth;
    restCenters = dockItems.map(it => {
      const r = it.getBoundingClientRect();
      return r.left + r.width / 2;
    });
  });
  dock.addEventListener('pointermove', e => {
    if (!restCenters) return;
    mouseX = e.clientX;
    if (!magRaf) magRaf = requestAnimationFrame(magnify);
  });
  dock.addEventListener('pointerleave', () => {
    restCenters = null;
    cancelAnimationFrame(magRaf);
    magRaf = 0;
    dockItems.forEach(it => it.style.removeProperty('--s'));
  });

  function magnify() {
    magRaf = 0;
    if (!restCenters) return;
    const sigma = restSize * 1.25;
    dockItems.forEach((it, i) => {
      const d = mouseX - restCenters[i];
      const scale = 1 + 0.6 * Math.exp(-(d * d) / (2 * sigma * sigma));
      it.style.setProperty('--s', scale.toFixed(3));
    });
  }

  /* =====================================================================
     MENUS (system menu + right-click desktop menu) and commands
     ===================================================================== */
  const systemBtn = $('#system-btn');
  const systemMenu = $('#system-menu');
  const ctxMenu = $('#context-menu');

  function closeMenus() {
    systemMenu.hidden = true;
    ctxMenu.hidden = true;
    systemBtn.setAttribute('aria-expanded', 'false');
  }

  function openMenu(menu, x, y) {
    closeMenus();
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    menu.style.left = clamp(x, 6, innerWidth - r.width - 6) + 'px';
    menu.style.top = clamp(y, 6, innerHeight - r.height - 6) + 'px';
    const first = $('button', menu);
    if (first) first.focus({ preventScroll: true });
  }

  systemBtn.addEventListener('click', () => {
    if (!systemMenu.hidden) { closeMenus(); return; }
    const r = systemBtn.getBoundingClientRect();
    openMenu(systemMenu, r.left, r.bottom + 4);
    systemBtn.setAttribute('aria-expanded', 'true');
  });

  $('#desktop').addEventListener('contextmenu', e => {
    if (e.target.closest('.window, .widget, .desk-icon')) return;
    e.preventDefault();
    openMenu(ctxMenu, e.clientX, e.clientY);
  });

  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.menu, #system-btn')) closeMenus();
  });

  document.addEventListener('keydown', e => {
    const openMenuEl = !systemMenu.hidden ? systemMenu : (!ctxMenu.hidden ? ctxMenu : null);
    if (e.key === 'Escape' && openMenuEl) {
      closeMenus();
      if (openMenuEl === systemMenu) systemBtn.focus();
      return;
    }
    // Arrow keys move through menu items
    if (openMenuEl && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const items = $$('button', openMenuEl);
      const i = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next].focus();
    }
  });

  addEventListener('blur', closeMenus);

  // Any element with data-open="app" opens that app; data-cmd runs a command.
  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      openApp(opener.dataset.open);
      if (opener.dataset.spanelGo) showSettingsPanel(opener.dataset.spanelGo);
      return;
    }
    const cmd = e.target.closest('[data-cmd]');
    if (cmd) {
      closeMenus();
      runCommand(cmd.dataset.cmd);
    }
  });

  function openIds() {
    return Object.keys(APPS).filter(id => S(id).open && !S(id).minimized);
  }

  function runCommand(cmd) {
    if (cmd === 'minimize-all') openIds().forEach(minimizeApp);
    else if (cmd === 'close-all') Object.keys(APPS).forEach(closeApp);
    else if (cmd === 'tidy') tidyWindows();
    else if (cmd === 'next-wallpaper') {
      settings.wallpaper = WALLPAPERS[(WALLPAPERS.indexOf(settings.wallpaper) + 1) % WALLPAPERS.length];
      swapWallpaper();
      saveSettings();
    } else if (cmd === 'restart') restart();
  }

  // Arrange open windows in a neat cascade.
  function tidyWindows() {
    if (isCompact()) return;
    const a = workArea();
    const ids = openIds().sort((x, y) => Number(winEl(x).style.zIndex) - Number(winEl(y).style.zIndex));
    ids.forEach((id, i) => {
      const w = winEl(id);
      const s = S(id);
      const width = Math.min(APPS[id].w, a.right - a.left - 120);
      const height = Math.min(APPS[id].h, a.bottom - a.top - 100);
      s.maximized = false;
      w.classList.remove('maximized');
      w.classList.add('geom');
      setRect(w, {
        width: width,
        height: height,
        left: clamp(a.left + 300 + i * 34, a.left, a.right - width),
        top: clamp(a.top + 10 + i * 30, a.top, a.bottom - height)
      });
      clearTimeout(w._geomT);
      w._geomT = setTimeout(() => w.classList.remove('geom'), 450);
    });
  }

  /* =====================================================================
     BOOT SCREEN, CLOCK, TOAST
     ===================================================================== */
  const boot = $('#boot');

  function runBoot(onDone) {
    boot.classList.remove('done', 'instant');
    const bar = $('.boot-bar span', boot);
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      boot.removeEventListener('click', finish);
      removeEventListener('keydown', finish);
      boot.classList.add('done');
      session.set('booted', '1');
      setTimeout(onDone, 250);
    };
    const timer = setTimeout(finish, reduceMotion() ? 400 : 2000);
    boot.addEventListener('click', finish);
    addEventListener('keydown', finish);
  }

  function restart() {
    Object.keys(APPS).forEach(closeApp);
    Object.keys(APPS).forEach(id => { S(id).placed = false; });
    cascade = 0;
    setTimeout(() => runBoot(startDesktop), 260);
  }

  function startDesktop() {
    openApp('welcome');
    openFromHash();
    updateNextWidget();
    // Wait two frames so the progress ring animates from 0.
    requestAnimationFrame(() => requestAnimationFrame(updateTrophyStats));
    setTimeout(showToast, 900);
  }

  // Deep links: index.html#finder, #photos, #notes ... open that app.
  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (Object.prototype.hasOwnProperty.call(APPS, id)) openApp(id);
  }
  addEventListener('hashchange', openFromHash);

  function showToast() {
    if (session.get('toast')) return;
    session.set('toast', '1');
    const toast = $('#toast');
    toast.classList.remove('leaving');
    toast.hidden = false;
    const hide = () => {
      if (toast.hidden || toast.classList.contains('leaving')) return;
      toast.classList.add('leaving');
      setTimeout(() => { toast.hidden = true; }, reduceMotion() ? 0 : 340);
    };
    $('#toast-close').onclick = hide;
    setTimeout(hide, 8000);
  }

  // Clock in the menu bar + clock widget + uptime in About
  const startTime = Date.now();
  let lastMinute = -1;
  function tick() {
    const now = new Date();
    const clock = $('#mb-clock');
    clock.textContent =
      now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + '  ' +
      now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    clock.dateTime = now.toISOString();

    if (now.getMinutes() !== lastMinute) {
      lastMinute = now.getMinutes();
      const hour12 = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12;
      const h = hour12 ? String(now.getHours() % 12 || 12) : String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      $('#w-time').innerHTML = h + '<span class="colon">:</span>' + m;
      $('#w-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
      const hr = now.getHours();
      $('#w-greet').textContent = hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    }

    const secs = Math.floor((Date.now() - startTime) / 1000);
    $('#uptime').textContent = secs < 60 ? secs + ' s' : Math.floor(secs / 60) + ' min ' + (secs % 60) + ' s';
  }
  tick();
  setInterval(tick, 1000);

  /* =====================================================================
     PHOTOS: profile picture fallback, tilt effect, favourite heart
     ===================================================================== */
  // If photo.png is missing, every avatar shows the "KA" initials instead.
  $$('.avatar-img').forEach(img => {
    const fail = () => img.closest('.avatar').classList.add('no-photo');
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener('error', fail);
  });

  const stage = $('#photo-stage');
  const frame = $('#photo-frame');
  stage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || reduceMotion()) return;
    const r = frame.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    const y = clamp((e.clientY - r.top) / r.height, 0, 1);
    frame.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(2) + 'deg');
    frame.style.setProperty('--rx', ((0.5 - y) * 16).toFixed(2) + 'deg');
    frame.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    frame.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  });
  stage.addEventListener('pointerleave', () => {
    ['--rx', '--ry', '--mx', '--my'].forEach(p => frame.style.removeProperty(p));
  });

  const heart = $('#heart-btn');
  heart.setAttribute('aria-pressed', String(store.get('fav', false)));
  heart.addEventListener('click', () => {
    const on = heart.getAttribute('aria-pressed') !== 'true';
    heart.setAttribute('aria-pressed', String(on));
    store.set('fav', on);
    heart.classList.remove('pop');
    void heart.offsetWidth;
    heart.classList.add('pop');
    if (on) sparkleAt(heart);
  });

  /* =====================================================================
     FINDER: filter by sidebar / search, grid or list view, preview pane
     ===================================================================== */
  const finderWin = winEl('finder');
  const filesEl = $('#files');
  const fileBtns = $$('.file', filesEl);
  const searchInput = $('#finder-search');
  const FILTER_NAMES = { all: 'All Projects', web: 'Web', python: 'Python', docs: 'Plans & Docs', games: 'Games', featured: 'Featured', homework: 'Homework' };
  let finderFilter = 'all';

  $$('.sidebar .side-item[data-filter]', finderWin).forEach(btn => {
    btn.addEventListener('click', () => {
      finderFilter = btn.dataset.filter;
      $$('.sidebar .side-item[data-filter]', finderWin).forEach(x => {
        x.classList.toggle('active', x === btn);
        if (x === btn) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current');
      });
      applyFinderFilter();
    });
  });
  searchInput.addEventListener('input', applyFinderFilter);

  function applyFinderFilter() {
    const q = searchInput.value.trim().toLowerCase();
    let shown = 0;
    fileBtns.forEach(btn => {
      const tags = btn.dataset.tags.split(' ');
      const match = (finderFilter === 'all' || tags.includes(finderFilter)) && (!q || btn.textContent.toLowerCase().includes(q));
      const li = btn.parentElement;
      li.hidden = !match;
      if (match) {
        li.style.setProperty('--i', shown++);
        li.classList.remove('pop');
        void li.offsetWidth;
        li.classList.add('pop');
      }
    });
    $('#finder-path').textContent = FILTER_NAMES[finderFilter] + (q ? ' · "' + searchInput.value.trim() + '"' : '');
    $('#finder-status').textContent = shown + (shown === 1 ? ' item' : ' items');
    $('#finder-empty').hidden = shown > 0;
    const selected = $('.file.selected', filesEl);
    if (selected && selected.parentElement.hidden) selectFile(null);
  }

  function selectFile(btn) {
    fileBtns.forEach(b => {
      b.classList.toggle('selected', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    const key = btn ? btn.dataset.file : 'none';
    $$('.preview', finderWin).forEach(p => { p.hidden = p.dataset.for !== key; });
    if (key === 'wave') startWave();
  }

  fileBtns.forEach(btn => {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => selectFile(btn));
    // Double-click runs the preview's main action (e.g. "Play Starfall").
    btn.addEventListener('dblclick', () => {
      const action = $('.preview[data-for="' + btn.dataset.file + '"] .btn', finderWin);
      if (action) action.click();
    });
  });

  $$('.seg [data-view]', finderWin).forEach(btn => {
    btn.addEventListener('click', () => setFinderView(btn.dataset.view));
  });
  function setFinderView(view) {
    filesEl.dataset.view = view;
    $$('.seg [data-view]', finderWin).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    store.set('finderView', view);
  }
  setFinderView(store.get('finderView', 'grid') === 'list' ? 'list' : 'grid');

  // A live version of animated_wave.py, drawn in the preview pane.
  const waveArt = $('#wave-art');
  const wavePreview = $('.preview[data-for="wave"]', finderWin);
  let wavePhase = 0;
  let waveTimer = 0;
  function drawWave() {
    const lines = [];
    for (let k = 0; k < 8; k++) {
      const v = Math.sin((wavePhase + k) * (Math.PI / 10));
      lines.push(' '.repeat(Math.round(v * 13 + 13)) + (v >= 0 ? 'O' : '*'));
    }
    waveArt.textContent = lines.join('\n');
    wavePhase++;
  }
  function startWave() {
    drawWave();
    if (waveTimer || reduceMotion()) return;
    waveTimer = setInterval(() => {
      if (finderWin.hidden || wavePreview.hidden) { clearInterval(waveTimer); waveTimer = 0; return; }
      drawWave();
    }, 110);
  }

  /* =====================================================================
     SAFARI: address bar, reload animation, count-up stats
     ===================================================================== */
  if (/^https?:$/.test(location.protocol)) {
    $('#address-text').textContent = location.host + location.pathname.replace(/index\.html$/, '');
  }

  function countUp() {
    $$('.report strong[data-count]').forEach(el => {
      const target = Number(el.dataset.count);
      if (!target || reduceMotion()) { el.textContent = target.toLocaleString(); return; }
      const t0 = performance.now();
      const step = now => {
        const p = Math.min((now - t0) / 1100, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  $('#reload-btn').addEventListener('click', () => {
    const page = $('#start-page');
    const btn = $('#reload-btn');
    page.classList.remove('reloading');
    btn.classList.remove('spin');
    void page.offsetWidth;
    page.classList.add('reloading');
    btn.classList.add('spin');
    countUp();
  });

  /* =====================================================================
     TABS (Notes list + Settings sidebar), with arrow-key support
     ===================================================================== */
  function initTabs(tabs, onShow) {
    const show = tab => {
      tabs.forEach(t => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (onShow) onShow(tab);
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', e => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        const next = tabs[(i + keys[e.key] + tabs.length) % tabs.length];
        next.focus();
        show(next);
      });
    });
    return show;
  }

  initTabs($$('.note-item'));
  const settingsTabs = $$('.settings [role="tab"]');
  const showSettingsTab = initTabs(settingsTabs);
  function showSettingsPanel(name) {
    const tab = settingsTabs.find(t => t.dataset.spanel === name);
    if (tab) showSettingsTab(tab);
  }

  /* =====================================================================
     NOTES: checklists saved locally + "Up next" widget
     ===================================================================== */
  const checks = store.get('checks', {});
  $$('.checklist input').forEach(cb => {
    cb.checked = Boolean(checks[cb.dataset.key]);
    cb.addEventListener('change', () => {
      checks[cb.dataset.key] = cb.checked;
      store.set('checks', checks);
      updateNextWidget();
      if (cb.checked) sparkleAt(cb);
    });
  });

  function updateNextWidget() {
    const build = $$('.checklist[data-list="build"] input');
    const done = build.filter(c => c.checked).length;
    const next = build.find(c => !c.checked);
    $('#w-next-title').textContent = next
      ? $('b', next.closest('label')).textContent.replace(/:$/, '')
      : 'Everything shipped!';
    $('#w-next-bar').style.width = (done / build.length) * 100 + '%';
    $('#w-next-count').textContent = done + ' of ' + build.length + ' build goals done';
  }

  /* =====================================================================
     ACHIEVEMENTS: progress rings, flip cards, filters
     ===================================================================== */
  const badges = $$('.badge');

  function updateTrophyStats() {
    const total = badges.length;
    const unlocked = badges.filter(b => b.dataset.state === 'unlocked').length;
    $('#w-ring').style.setProperty('--p', (unlocked / total).toFixed(3));
    $('#w-ring-num').textContent = unlocked;
    $('#t-ring-num').textContent = unlocked;
    $('#w-trophy-sum').textContent = unlocked + ' of ' + total + ' unlocked';
    $('#trophy-summary').textContent = unlocked + ' of ' + total + ' unlocked. Click a badge to flip it.';
  }

  function animateTrophies() {
    const ring = $('#t-ring');
    const unlocked = badges.filter(b => b.dataset.state === 'unlocked').length;
    ring.style.setProperty('--p', '0');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ring.style.setProperty('--p', (unlocked / badges.length).toFixed(3));
    }));
    staggerBadges();
  }

  function staggerBadges() {
    let i = 0;
    badges.forEach(b => {
      if (b.hidden) return;
      b.style.setProperty('--i', i++);
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
    });
  }

  badges.forEach(b => {
    const card = $('.badge-card', b);
    card.addEventListener('click', () => {
      const flipped = card.getAttribute('aria-pressed') !== 'true';
      card.setAttribute('aria-pressed', String(flipped));
      if (flipped && b.dataset.state === 'unlocked') sparkleAt(card);
    });
  });

  $$('[data-tfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.tfilter;
      $$('[data-tfilter]').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
      badges.forEach(b => { b.hidden = !(f === 'all' || b.dataset.state === f); });
      staggerBadges();
    });
  });

  /* =====================================================================
     SYSTEM SETTINGS: inputs
     ===================================================================== */
  $$('input[name="theme"]').forEach(r => r.addEventListener('change', () => {
    settings.theme = r.value;
    saveSettings(true);
  }));
  $$('input[name="accent"]').forEach(r => r.addEventListener('change', () => {
    settings.accent = r.value;
    saveSettings(true);
  }));
  $$('input[name="wallpaper"]').forEach(r => r.addEventListener('change', () => {
    settings.wallpaper = r.value;
    swapWallpaper();
    saveSettings();
  }));
  $('#dock-size').addEventListener('input', e => {
    settings.dockSize = Number(e.target.value);
    saveSettings();
    refit();
  });
  $('#magnify').addEventListener('change', e => { settings.magnify = e.target.checked; saveSettings(); });
  $('#reduce-motion').addEventListener('change', e => { settings.reduceMotion = e.target.checked; saveSettings(); });
  $('#reset-settings').addEventListener('click', () => {
    const wallpaperChanged = settings.wallpaper !== DEFAULTS.wallpaper;
    settings = Object.assign({}, DEFAULTS);
    if (wallpaperChanged) swapWallpaper();
    saveSettings(true);
    refit();
  });

  const onSchemeChange = () => { if (settings.theme === 'auto') applySettings(); };
  const onMotionChange = () => applySettings();
  if (media.light.addEventListener) {
    media.light.addEventListener('change', onSchemeChange);
    media.reduce.addEventListener('change', onMotionChange);
  }

  /* =====================================================================
     TRASH
     ===================================================================== */
  const trashList = $('#trash-list');
  const trashEmpty = $('#trash-empty');
  const emptyBtn = $('#empty-trash');
  const trashUse = $('#trash-use');

  emptyBtn.addEventListener('click', () => {
    const items = $$('li', trashList);
    items.forEach((li, i) => li.style.setProperty('--i', i));
    const finish = () => {
      trashList.classList.remove('emptying');
      trashList.hidden = true;
      trashEmpty.hidden = false;
      emptyBtn.disabled = true;
      trashUse.setAttribute('href', '#i-trash-empty');
    };
    if (reduceMotion()) { finish(); return; }
    trashList.classList.add('emptying');
    setTimeout(finish, 500 + items.length * 60);
  });

  $('#restore-trash').addEventListener('click', () => {
    trashList.hidden = false;
    trashEmpty.hidden = true;
    emptyBtn.disabled = false;
    trashUse.setAttribute('href', '#i-trash-full');
  });

  /* =====================================================================
     SPARKLES: a small confetti burst for unlocked badges and ticked goals
     ===================================================================== */
  const canvas = $('#sparkles');
  const ctx = canvas.getContext('2d');
  const COLORS = ['#FF6B57', '#9B7BFF', '#2ED3B7', '#FFC24B'];
  let particles = [];
  let sparkRaf = 0;
  let dpr = 1;

  function resizeSparkles() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }
  resizeSparkles();

  function sparkleAt(el) {
    if (reduceMotion()) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4.5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.2,
        size: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        life: 1,
        color: COLORS[i % COLORS.length]
      });
    }
    if (!sparkRaf) sparkRaf = requestAnimationFrame(stepSparkles);
  }

  function stepSparkles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.vx *= 0.98;
      p.rot += 0.12;
      p.life -= 0.02;
      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.translate(p.x * dpr, p.y * dpr);
      ctx.rotate(p.rot);
      ctx.fillRect((-p.size / 2) * dpr, (-p.size / 4) * dpr, p.size * dpr, (p.size / 2) * dpr);
      ctx.restore();
    });
    sparkRaf = particles.length ? requestAnimationFrame(stepSparkles) : 0;
  }

  /* =====================================================================
     Per-app hooks run each time an app opens
     ===================================================================== */
  const APP_HOOKS = {
    achievements: animateTrophies,
    safari: countUp,
    finder: () => { if (!wavePreview.hidden) startWave(); }
  };

  /* =====================================================================
     START
     ===================================================================== */
  // Start the widget ring at 0 so it animates in once the desktop appears.
  $('#w-ring').style.setProperty('--p', '0');

  if (session.get('booted') || reduceMotion()) {
    boot.classList.add('instant', 'done');
    startDesktop();
  } else {
    runBoot(startDesktop);
  }
})();
