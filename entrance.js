/* Fullscreen host for the supplied, unchanged four-second v3 animation.
   One entrance per tab session; no new animation or delay after completion. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const sessionKey = 'observer:entrance:v3:seen';
  if (reduced.matches) return;
  try { if (sessionStorage.getItem(sessionKey) === '1') return; } catch {}

  const intro = document.createElement('iframe');
  intro.id = 'observer-entrance';
  intro.title = document.documentElement.lang.startsWith('pt')
    ? 'Introdução do The Machine Observer' : 'The Machine Observer introduction';
  intro.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:white;z-index:2147483647;color-scheme:light';
  const previousFocus = document.activeElement;
  const content = [...document.body.children].filter(el =>
    el instanceof HTMLElement && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)
  );
  const inertState = content.map(el => [el, el.inert]);
  const scrollState = [document.documentElement, document.body].map(el =>
    [el, el.style.getPropertyValue('overflow'), el.style.getPropertyPriority('overflow')]
  );
  let closed = false, timeout, remaining = 10000, resumedAt;

  function closeIntro() {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    reduced.removeEventListener('change', onReduced);
    intro.remove();
    inertState.forEach(([el, wasInert]) => { el.inert = wasInert; });
    scrollState.forEach(([el, value, priority]) => {
      if (value) el.style.setProperty('overflow', value, priority);
      else el.style.removeProperty('overflow');
    });
    try { sessionStorage.setItem(sessionKey, '1'); } catch {}
    if (previousFocus?.isConnected && previousFocus !== document.body) {
      previousFocus.focus({preventScroll:true});
    } else {
      const main = document.getElementById('main');
      if (main) { main.setAttribute('tabindex', '-1'); main.focus({preventScroll:true}); }
    }
  }
  function onMessage(event) {
    if (event.source === intro.contentWindow && event.origin === location.origin &&
        event.data?.type === 'machine-observer:complete') closeIntro();
  }
  function onKey(event) { if (event.key === 'Escape') closeIntro(); }
  function onReduced() { if (reduced.matches) closeIntro(); }
  function resumeWatchdog() {
    resumedAt = performance.now();
    timeout = setTimeout(closeIntro, remaining);
  }
  function onVisibility() {
    clearTimeout(timeout);
    if (document.hidden) remaining = Math.max(0, remaining - (performance.now() - resumedAt));
    else resumeWatchdog();
  }
  // Register cleanup before mounting. The fallback uses visible time, matching
  // the supplied animation's hidden-tab pause, and also covers a failed iframe.
  window.addEventListener('message', onMessage);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onReduced);
  intro.addEventListener('error', closeIntro);
  intro.src = new URL('assets/machine-observer-intro-v3-moving-machinery.html', document.baseURI).href;
  content.forEach(el => { el.inert = true; });
  scrollState.forEach(([el]) => el.style.setProperty('overflow', 'hidden'));
  document.body.append(intro);
  intro.focus();
  if (!document.hidden) resumeWatchdog();
})();
