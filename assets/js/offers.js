// Offers slider: autoplay with progress bars, tabs, arrows, swipe and keyboard.
(function () {
  const root = document.querySelector('[data-offers]');
  if (!root) return;
  const slides = [...root.querySelectorAll('.offer')];
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const pauseBtn = root.querySelector('[data-offer-pause]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MS = 7000;
  root.style.setProperty('--offer-ms', MS + 'ms');
  let index = 0;
  let userPaused = reduce;
  let hovering = false;

  const syncState = () => {
    const paused = userPaused || hovering || document.hidden;
    root.classList.toggle('playing', !userPaused);
    root.classList.toggle('paused', paused);
    root.classList.toggle('user-paused', userPaused);
    if (pauseBtn) pauseBtn.setAttribute('aria-label', userPaused ? 'Play slides' : 'Pause slides');
  };

  function go(next, focusTab) {
    index = (next + slides.length) % slides.length;
    slides.forEach((s, i) => {
      const on = i === index;
      s.classList.toggle('is-active', on);
      s.toggleAttribute('inert', !on);
      if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === index));
      t.tabIndex = i === index ? 0 : -1;
      t.classList.toggle('done', i < index);
      // restart the progress animation on the active tab
      const bar = t.querySelector('.tab-bar i');
      bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    });
    if (focusTab) tabs[index].focus();
  }

  // Advance when the active progress bar finishes
  root.addEventListener('animationend', (e) => {
    if (e.animationName === 'fill' && e.target.closest('[aria-selected="true"]')) go(index + 1);
  });

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => go(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1, true); }
    });
  });
  root.querySelector('[data-offer-prev]')?.addEventListener('click', () => go(index - 1));
  root.querySelector('[data-offer-next]')?.addEventListener('click', () => go(index + 1));
  pauseBtn?.addEventListener('click', () => { userPaused = !userPaused; syncState(); });

  // Pause while the visitor is reading or using a slide
  root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; syncState(); } });
  root.addEventListener('pointerleave', () => { hovering = false; syncState(); });
  root.addEventListener('focusin', () => { hovering = true; syncState(); });
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) { hovering = false; syncState(); } });
  document.addEventListener('visibilitychange', syncState);

  // Swipe
  const track = root.querySelector('.offer-track');
  let x0 = null, y0 = null;
  track.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  track.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
    x0 = y0 = null;
  });

  // Only run while the slider is on screen
  new IntersectionObserver(([e]) => { hovering = hovering && e.isIntersecting; root.classList.toggle('offscreen', !e.isIntersecting); syncState(); }).observe(root);
  syncState();
  go(0);
})();
