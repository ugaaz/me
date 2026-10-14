// ugaaz.com — shared behaviour: header, navigation, WhatsApp composer
(function () {
  const root = document.documentElement;
  const WA = '252613333489';

  // Header state
  const top = document.querySelector('.top');
  const onScroll = () => top && top.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Research dropdown
  document.querySelectorAll('.dd').forEach((dd) => {
    const btn = dd.querySelector('button');
    const close = () => { dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !dd.classList.contains('open');
      dd.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) close(); });
    dd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); btn.focus(); } });
  });

  // Mobile menu
  const nav = document.querySelector('.nav');
  const menuBtn = document.querySelector('.menu-btn');
  menuBtn && menuBtn.addEventListener('click', () => {
    const open = !nav.classList.contains('mobile-open');
    nav.classList.toggle('mobile-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav && nav.addEventListener('click', (e) => {
    if (e.target.closest('a') && nav.classList.contains('mobile-open')) {
      nav.classList.remove('mobile-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // WhatsApp links with a prefilled message
  document.querySelectorAll('[data-wa]').forEach((a) => {
    const msg = a.getAttribute('data-wa') || 'Asc Ugaaz, I would like to talk about a project.';
    a.href = `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  // Project composer: builds a WhatsApp message from the form
  const form = document.querySelector('[data-composer]');
  if (form) {
    const note = form.querySelector('.form-note');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get('name') || '').toString().trim();
      const need = (data.get('need') || '').toString();
      const where = (data.get('where') || '').toString();
      const detail = (data.get('detail') || '').toString().trim();
      if (!name || !need) {
        note.textContent = !name ? 'Add your name so I know who is writing.' : 'Pick what you need help with.';
        note.classList.add('err');
        (!name ? form.querySelector('[name=name]') : form.querySelector('[name=need]')).focus();
        return;
      }
      note.classList.remove('err');
      const lines = [
        `Asc Ugaaz, I'm ${name}.`,
        `I need help with: ${need}.`,
        where ? `Based in: ${where}.` : '',
        detail ? `Details: ${detail}` : '',
      ].filter(Boolean);
      const url = `https://wa.me/${WA}?text=${encodeURIComponent(lines.join('\n'))}`;
      const win = window.open(url, '_blank', 'noopener');
      note.textContent = '';
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'Open WhatsApp to send it';
      note.append(win ? 'WhatsApp opened with your message. If it didn\'t, ' : 'Your message is ready. ', a, '.');
    });
  }

  // Year
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
