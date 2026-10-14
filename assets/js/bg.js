// Slow parallax for section background images
(function () {
  const imgs = [...document.querySelectorAll('[data-bg-parallax]')];
  if (!imgs.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    imgs.forEach((img) => {
      const box = img.parentElement.getBoundingClientRect();
      if (box.bottom < -100 || box.top > vh + 100) return;
      const progress = (box.top + box.height / 2 - vh / 2) / vh; // -1 .. 1 around the middle of the screen
      img.style.transform = `translate3d(0, ${(progress * -48).toFixed(1)}px, 0) scale(1.14)`;
    });
    ticking = false;
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
