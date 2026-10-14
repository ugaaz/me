// Hero background: places the workstation image so the headline, the vertical screen
// and the person all stay visible, pins the glitching logo onto the angled screen,
// and adds a slow parallax.
(function () {
  const hero = document.querySelector('.hero');
  const inner = document.querySelector('[data-parallax]');
  const img = document.querySelector('[data-hero-img]');
  const logo = document.querySelector('[data-screen-logo]');
  const copy = document.querySelector('.hero-copy');
  if (!hero || !inner || !img) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 1101px)');

  // Measurements in the source image (hero.webp, 1376 x 768)
  const IW = 1376, IH = 768;
  const QUAD = [[530, 108], [645, 117], [645, 462], [531, 472]]; // screen corners: TL, TR, BR, BL
  const SCREEN_LEFT = 528;   // left edge of the vertical monitor
  const PERSON_RIGHT = 1190; // right edge of the person's head and shoulder
  const NARROW_RANGE = [495, 1255]; // part of the image to show on phones and tablets
  const BOX = [100, 300];    // logo element size before it is mapped onto the screen

  // Solve the 3x3 homography that maps the BOX rectangle onto four points
  function homography(dst) {
    const [w, h] = BOX;
    const src = [[0, 0], [w, 0], [w, h], [0, h]];
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    // Gaussian elimination
    for (let c = 0; c < 8; c++) {
      let p = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const m = b.map((v, i) => v / A[i][i]);
    // matrix3d is column-major
    return `matrix3d(${m[0]},${m[3]},0,${m[6]},${m[1]},${m[4]},0,${m[7]},0,0,1,0,${m[2]},${m[5]},0,1)`;
  }

  function layout() {
    const W = hero.clientWidth;
    let s, ox, oy = 0;
    if (wide.matches) {
      const H = hero.clientHeight;
      s = H / IH;
      const copyRight = copy ? copy.getBoundingClientRect().right - hero.getBoundingClientRect().left : W * 0.4;
      ox = copyRight + 32 - SCREEN_LEFT * s;          // screen starts just right of the text
      ox = Math.min(ox, W - PERSON_RIGHT * s - 24);    // keep the person in frame
      ox = Math.max(ox, W - IW * s);                   // no gap at the right edge
      hero.style.removeProperty('--bg-h');
    } else {
      const span = NARROW_RANGE[1] - NARROW_RANGE[0];
      s = Math.max(Math.min(W / span, (window.innerHeight * 0.6) / IH), W / IW);
      ox = (W - span * s) / 2 - NARROW_RANGE[0] * s;
      ox = Math.min(0, Math.max(ox, W - IW * s));
      hero.style.setProperty('--bg-h', `${Math.round(IH * s)}px`);
    }
    Object.assign(img.style, { left: `${ox}px`, top: `${oy}px`, width: `${IW * s}px`, height: `${IH * s}px` });
    if (logo) {
      logo.style.transform = homography(QUAD.map(([x, y]) => [ox + x * s, oy + y * s]));
      logo.hidden = false;
    }
  }

  const run = () => requestAnimationFrame(layout);
  if (img.complete) run(); else img.addEventListener('load', run);
  new ResizeObserver(run).observe(hero);
  wide.addEventListener('change', run);
  document.fonts && document.fonts.ready.then(run);

  if (reduce) return;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = Math.min(window.scrollY, hero.offsetHeight);
      inner.style.transform = `translate3d(0, ${(y * 0.2).toFixed(1)}px, 0)`;
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
