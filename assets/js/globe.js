// 3D globe for the ugaaz.com hero: dotted land, routes flowing into Mogadishu and Nairobi.
import * as THREE from './three.module.min.js';
import LAND from '../data/land.js';

const stage = document.querySelector('[data-globe]');
if (stage) init(stage).catch((e) => { console.warn('Globe disabled:', e); stage.classList.add('globe-off'); });

async function init(stage) {
  const canvas = stage.querySelector('canvas');
  const labelLayer = stage.querySelector('.globe-labels');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  const tilt = new THREE.Group();   // fixed latitude tilt
  const spin = new THREE.Group();   // longitude + interaction
  tilt.add(spin);
  scene.add(tilt);

  const R = 1;
  const v3 = (lat, lon, r = R) => {
    const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };

  // Palette read from CSS so the globe follows the site theme
  const css = () => getComputedStyle(document.documentElement);
  const col = (name) => new THREE.Color(css().getPropertyValue(name).trim() || '#ffffff');
  const isLight = () => css().getPropertyValue('color-scheme').trim() === 'light';

  // Core sphere hides dots on the far side
  const coreMat = new THREE.MeshBasicMaterial({ color: col('--bg-2') });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 96, 96), coreMat));

  // Atmosphere rim
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col('--blue') }, uStrength: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uColor, f * 0.9 * uStrength); }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 64, 64), atmoMat);
  tilt.add(atmo);

  // Land dots
  const bin = atob(LAND), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const raw = new Int16Array(bytes.buffer);
  const n = raw.length / 3;
  const pos = new Float32Array(n * 3), kind = new Float32Array(n), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = v3(raw[i * 3] / 100, raw[i * 3 + 1] / 100, R * 1.002);
    pos.set([p.x, p.y, p.z], i * 3);
    kind[i] = raw[i * 3 + 2];
    seed[i] = Math.random();
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dotGeo.setAttribute('kind', new THREE.BufferAttribute(kind, 1));
  dotGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dotMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPx: { value: 1 },
      uBase: { value: col('--silver') }, uSo: { value: col('--gold') }, uKe: { value: col('--blue') },
      uAlpha: { value: 0.85 },
    },
    vertexShader: `attribute float kind; attribute float seed; uniform float uTime; uniform float uPx;
      varying float vKind; varying float vFace; varying float vSeed;
      void main(){
        vKind = kind; vSeed = seed;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normalize(position));
        vFace = dot(n, normalize(-mv.xyz));
        float s = kind > 0.5 ? 2.6 : 1.7;
        gl_PointSize = s * uPx * (4.4 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uBase; uniform vec3 uSo; uniform vec3 uKe; uniform float uTime; uniform float uAlpha;
      varying float vKind; varying float vFace; varying float vSeed;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
        vec3 color = vKind > 1.5 ? uKe : (vKind > 0.5 ? uSo : uBase);
        float tw = vKind > 0.5 ? 0.75 + 0.25 * sin(uTime * 2.2 + vSeed * 6.28) : 1.0;
        float edge = smoothstep(0.5, 0.25, d);
        float a = edge * smoothstep(-0.05, 0.35, vFace) * (vKind > 0.5 ? 1.0 : uAlpha) * tw;
        gl_FragColor = vec4(color, a);
      }`,
    transparent: true, depthWrite: false,
  });
  spin.add(new THREE.Points(dotGeo, dotMat));

  // Cities
  const MOG = { lat: 2.0469, lon: 45.3182, name: 'Mogadishu' };
  const NBO = { lat: -1.2921, lon: 36.8219, name: 'Nairobi' };
  const hubs = [
    { lat: 25.2048, lon: 55.2708, to: MOG },  // Dubai
    { lat: 23.8103, lon: 90.4125, to: MOG },  // Dhaka
    { lat: 51.5072, lon: -0.1276, to: NBO },  // London
    { lat: 41.0082, lon: 28.9784, to: MOG },  // Istanbul
    { lat: -1.9441, lon: 30.0619, to: NBO },  // Kigali
    { lat: 23.1291, lon: 113.2644, to: NBO }, // Guangzhou
    { lat: 19.076, lon: 72.8777, to: NBO },   // Mumbai
  ];

  const arcMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: col('--gold') }, uTrail: { value: col('--blue') }, uStatic: { value: reduce ? 1 : 0 } },
    vertexShader: `varying float vU; varying float vOff; attribute float offset;
      void main(){ vU = uv.x; vOff = offset; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform vec3 uTrail; uniform float uStatic; varying float vU; varying float vOff;
      void main(){
        float head = fract(uTime * 0.18 + vOff);
        float d = head - vU; if (d < 0.0) d += 1.0;
        float pulse = smoothstep(0.32, 0.0, d) * step(0.0, d);
        float base = 0.16;
        float a = mix(base + pulse, 0.55, uStatic);
        vec3 c = mix(uTrail, uColor, pulse);
        gl_FragColor = vec4(c, a * smoothstep(0.0, 0.06, vU));
      }`,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  });

  const makeArc = (a, b, off) => {
    const p0 = v3(a.lat, a.lon, R), p2 = v3(b.lat, b.lon, R);
    const dist = p0.distanceTo(p2);
    const mid = p0.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(R + dist * 0.42);
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
    const geo = new THREE.TubeGeometry(curve, 96, 0.0042, 6, false);
    const count = geo.attributes.position.count;
    geo.setAttribute('offset', new THREE.BufferAttribute(new Float32Array(count).fill(off), 1));
    return new THREE.Mesh(geo, arcMat);
  };
  hubs.forEach((h, i) => spin.add(makeArc(h, h.to, i / hubs.length)));
  spin.add(makeArc(MOG, NBO, 0.5));

  // Hub points
  const hubMat = new THREE.MeshBasicMaterial({ color: col('--blue') });
  hubs.forEach((h) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 12), hubMat); m.position.copy(v3(h.lat, h.lon, R * 1.003)); spin.add(m); });

  // City beacons with pulsing rings
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: col('--gold') } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){ vec2 c = vUv - 0.5; float d = length(c) * 2.0; float t = fract(uTime * 0.5);
        float ring = smoothstep(0.08, 0.0, abs(d - t)) * (1.0 - t);
        float core = smoothstep(0.2, 0.12, d);
        float a = max(ring, core); if (a < 0.01) discard; gl_FragColor = vec4(uColor, a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const beacons = [MOG, NBO].map((c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), ringMat);
    const p = v3(c.lat, c.lon, R * 1.006);
    m.position.copy(p);
    m.lookAt(p.clone().multiplyScalar(2));
    spin.add(m);
    return { ...c, p, mesh: m };
  });

  // HTML labels
  const labels = beacons.map((b) => {
    const el = document.createElement('span');
    el.className = 'globe-label';
    el.dataset.side = b === beacons[0] ? 'right' : 'left';
    el.innerHTML = `<span>${b.name}</span>`;
    labelLayer.appendChild(el);
    return { el, p: b.p };
  });

  // Face the Horn of Africa
  const focus = v3(4, 42, 1);
  const baseY = -Math.atan2(focus.x, focus.z);
  tilt.rotation.x = 4 * Math.PI / 180 + 0.18;
  tilt.rotation.z = -0.12;
  spin.rotation.y = baseY;

  // Interaction: drag to turn, springs back toward East Africa
  let dragging = false, lastX = 0, lastY = 0, velX = 0, offY = 0, offX = 0;
  const onDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; velX = 0; stage.classList.add('grabbing'); };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velX = dx * 0.006; offY += velX;
    offX = Math.max(-0.5, Math.min(0.5, offX + dy * 0.004));
  };
  const onUp = () => { dragging = false; stage.classList.remove('grabbing'); };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvas.style.touchAction = 'pan-y';

  // Theme changes
  const applyTheme = () => {
    coreMat.color = col('--bg-2');
    atmoMat.uniforms.uColor.value = col('--blue');
    atmoMat.uniforms.uStrength.value = isLight() ? 0.5 : 1;
    atmoMat.blending = isLight() ? THREE.NormalBlending : THREE.AdditiveBlending;
    atmoMat.needsUpdate = true;
    dotMat.uniforms.uBase.value = col('--silver');
    dotMat.uniforms.uSo.value = col('--gold');
    dotMat.uniforms.uKe.value = col('--blue');
    dotMat.uniforms.uAlpha.value = isLight() ? 0.7 : 0.85;
    arcMat.uniforms.uColor.value = col('--gold');
    arcMat.uniforms.uTrail.value = col('--blue');
    ringMat.uniforms.uColor.value = col('--gold');
    hubMat.color = col('--blue');
  };
  applyTheme();
  document.addEventListener('themechange', applyTheme);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

  // Size
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the globe filling the shorter side
    const fit = w / h < 1 ? 4.4 / Math.max(w / h, 0.62) : 4.4;
    camera.position.z = fit;
    camera.updateProjectionMatrix();
    dotMat.uniforms.uPx.value = renderer.getPixelRatio() * Math.min(1.25, Math.max(0.75, h / 640));
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Loop, paused when off screen
  let visible = true, raf = 0, t0 = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) loop(); }, { rootMargin: '100px' }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) loop(); });

  const tmp = new THREE.Vector3(), camDir = new THREE.Vector3();
  function loop() {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = (performance.now() - t0) / 1000;
    if (!dragging) {
      offY += velX; velX *= 0.94;
      offY *= 0.985; offX *= 0.96;
    }
    const sway = reduce ? 0 : Math.sin(t * 0.12) * 0.32;
    spin.rotation.y = baseY + sway + offY;
    spin.rotation.x = offX;
    const tt = reduce ? 0 : t;
    dotMat.uniforms.uTime.value = tt;
    arcMat.uniforms.uTime.value = tt;
    ringMat.uniforms.uTime.value = reduce ? 0.35 : t;
    renderer.render(scene, camera);

    // labels
    const w = stage.clientWidth, h = stage.clientHeight;
    camera.getWorldDirection(camDir);
    labels.forEach((l) => {
      tmp.copy(l.p);
      spin.localToWorld(tmp);
      const facing = tmp.clone().normalize().dot(camDir.clone().negate());
      tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      l.el.style.opacity = facing > 0.25 ? '1' : '0';
    });
    raf = requestAnimationFrame(loop);
  }
  stage.classList.add('globe-ready');
  loop();
}
