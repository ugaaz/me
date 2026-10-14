// Hero background: slow parallax, and the glitching logo pinned to a screen in the image.
(function () {
  const inner = document.querySelector('[data-parallax]');
  const img = document.querySelector('[data-hero-img]');
  const logo = document.querySelector('[data-screen-logo]');
  if (!inner || !img) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Screen rectangle inside the source image, as fractions of its width and height.
  // Set once the final workstation image is in: e.g. { x: 0.71, y: 0.18, w: 0.09, h: 0.32 }
  const SCREEN = null;

  const place = () => {
    if (!SCREEN || !logo || !img.naturalWidth) return;
    const W = img.clientWidth, H = img.clientHeight;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(W / iw, H / ih);
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    const ox = (W - iw * s) * px, oy = (H - ih * s) * py;
    Object.assign(logo.style, {
      left: `${ox + SCREEN.x * iw * s}px`, top: `${oy + SCREEN.y * ih * s}px`,
      width: `${SCREEN.w * iw * s}px`, height: `${SCREEN.h * ih * s}px`,
    });
    logo.hidden = false;
  };
  if (img.complete) place(); else img.addEventListener('load', place);
  new ResizeObserver(place).observe(img);

  if (reduce) return;
  let ticking = false;
  const hero = inner.closest('.hero');
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = Math.min(window.scrollY, hero.offsetHeight);
      inner.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0) scale(${(1 + y / hero.offsetHeight * 0.06).toFixed(4)})`;
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
