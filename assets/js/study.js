// "Online but not in service" — charts and data explorer
(function () {
  // Indicator-level coding, 13–14 October 2026 (from the working paper appendix)
  const SITES = [
    ['Central Bank of Somalia', 'Federal', '11101', '11110', '00001', '01010', '11101'],
    ['Ministry of Planning', 'Federal', '11101', '11111', '00000', '01110', '11100'],
    ['Office of the Prime Minister', 'Federal', '11100', '11110', '00000', '01010', '11111'],
    ['Puntland Ministry of Finance', 'State', '11101', '11110', '10001', '01010', '11000'],
    ['Ministry of Finance', 'Federal', '11100', '11110', '00000', '01110', '11100'],
    ['Immigration and Citizenship Agency', 'Federal', '10001', '10011', '10100', '01000', '11111'],
    ['Ministry of Foreign Affairs', 'Federal', '11100', '11110', '10000', '01000', '11100'],
    ['Ministry of Education', 'Federal', '11001', '01100', '00101', '01000', '11100'],
    ['Villa Somalia (Office of the President)', 'Federal', '11101', '00010', '00000', '01000', '11111'],
    ['Ministry of Health', 'Federal', '11000', '11110', '00000', '01010', '11100'],
    ['Ministry of Justice', 'Federal', '11000', '11110', '00000', '01100', '11100'],
    ['Jubaland State', 'State', '11100', '11010', '00000', '01000', '11100'],
    ['Supreme Court', 'Federal', '11001', '01010', '00000', '01100', '11000'],
    ['Banadir Regional Administration', 'Regional', '00000', '00000', '00000', '00000', '11000'],
    ['Ministry of Commerce and Industry', 'Federal', '00000', '00000', '00000', '00000', '11000'],
    ['Ministry of Interior', 'Federal', '00000', '00000', '00000', '00000', '11000'],
  ];
  const DIMS = [
    { key: 'IF', short: 'Institutional', name: 'Institutional framework', ind: ['Mandate or about page', 'Leadership or structure', 'Laws, policies or regulations', 'Privacy policy or terms of use', 'Full contact details'] },
    { key: 'CP', short: 'Content', name: 'Content', ind: ['News dated within 90 days', 'Downloadable reports', 'Content in Somali', 'Content in English', 'Site search'] },
    { key: 'SP', short: 'Services', name: 'Online services', ind: ['Requirements stated for a service', 'Downloadable application forms', 'Online application or booking', 'Online payment', 'Online lookup, verification or tracking'] },
    { key: 'EP', short: 'Participation', name: 'E-participation', ind: ['Online feedback or complaint form', 'Social media links', 'Newsletter or alerts', 'Statistics or dashboards', 'Online consultation tool'] },
    { key: 'TE', short: 'Technology', name: 'Technology', ind: ['HTTPS', 'Mobile viewport', 'Indexable without JavaScript', 'No placeholder or template content', 'No dead links'] },
  ];
  const SHORT = {"Central Bank of Somalia": "Central Bank", "Ministry of Planning": "Planning", "Office of the Prime Minister": "Prime Minister's Office", "Puntland Ministry of Finance": "Puntland Finance", "Ministry of Finance": "Finance", "Immigration and Citizenship Agency": "Immigration", "Ministry of Foreign Affairs": "Foreign Affairs", "Ministry of Education": "Education", "Villa Somalia (Office of the President)": "Villa Somalia", "Ministry of Health": "Health", "Ministry of Justice": "Justice", "Jubaland State": "Jubaland State", "Supreme Court": "Supreme Court", "Banadir Regional Administration": "Banadir Region", "Ministry of Commerce and Industry": "Commerce and Industry", "Ministry of Interior": "Interior"};
  const LEVEL_COLOR = { Federal: 'var(--blue)', State: 'var(--silver)', Regional: 'var(--gold)' };

  const rows = SITES.map(([name, level, ...codes]) => {
    const bits = codes.join('').split('').map(Number);
    return { name, level, bits, score: bits.reduce((a, b) => a + b, 0) / 25 };
  }).sort((a, b) => b.score - a.score);

  const fmt = (v) => v.toFixed(2);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Ranking
  const rank = document.querySelector('[data-rank]');
  if (rank) {
    rank.innerHTML = rows.map((r) => `
      <div class="rank-row" role="listitem">
        <span class="name" title="${esc(r.name)}">${esc(r.name)}</span>
        <span class="val">${fmt(r.score)}</span>
        <span class="track" aria-hidden="true"><span class="fill" style="--v:${r.score * 100}%;--c:${LEVEL_COLOR[r.level]}"></span><span class="mean-line"></span></span>
      </div>`).join('');
  }

  // Matrix
  const table = document.querySelector('[data-matrix]');
  const keyEl = document.querySelector('[data-key]');
  if (table) {
    const head = `<thead><tr><th scope="col" rowspan="2" style="text-align:left;vertical-align:bottom">Website</th>${DIMS.map((d, di) =>
      `<th scope="colgroup" colspan="5" data-dim="${di}" class="dim-start grp" title="${d.name}">${d.short}</th>`).join('')}<th scope="col" rowspan="2" style="text-align:right;vertical-align:bottom">Score</th></tr>
      <tr>${DIMS.map((d, di) => d.ind.map((_, i) =>
      `<th scope="col" data-dim="${di}" class="${i === 0 ? 'dim-start' : ''}" title="${esc(d.ind[i])}"><span class="vh">${d.key}</span>${i + 1}</th>`).join('')).join('')}</tr></thead>`;
    const body = `<tbody>${rows.map((r) => `<tr><th scope="row" title="${esc(r.name)}">${esc(SHORT[r.name] || r.name)}</th>${r.bits.map((b, j) => {
      const di = Math.floor(j / 5), ii = j % 5;
      const label = `${DIMS[di].ind[ii]}: ${b ? 'present' : 'absent'}`;
      return `<td data-dim="${di}" class="${ii === 0 ? 'dim-start' : ''}"><span class="cell ${b ? 'on' : ''}" role="img" aria-label="${esc(label)}" title="${esc(label)}"></span></td>`;
    }).join('')}<td class="score">${fmt(r.score)}</td></tr>`).join('')}</tbody>`;
    table.innerHTML = head + body;

    const renderKey = (di) => {
      const dims = di === 'all' ? DIMS.map((_, i) => i) : [Number(di)];
      keyEl.innerHTML = dims.map((d) => DIMS[d].ind.map((label, i) => {
        const count = rows.reduce((a, r) => a + r.bits[d * 5 + i], 0);
        return `<div class="${count === 0 ? 'zero' : ''}"><b>${DIMS[d].key}${i + 1}</b>${esc(label)}: <span class="count">${count} of 16</span></div>`;
      }).join('')).join('');
    };

    const tabs = document.querySelectorAll('[data-tab]');
    const show = (di) => {
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.tab === String(di))));
      table.querySelectorAll('[data-dim]').forEach((c) => c.classList.toggle('hidden-col', di !== 'all' && c.dataset.dim !== String(di)));
      renderKey(di);
    };
    tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab === 'all' ? 'all' : Number(t.dataset.tab))));
    show(window.innerWidth < 700 ? 2 : 'all');
  }

  // Table of contents highlighting
  const links = [...document.querySelectorAll('.toc a')];
  if (links.length && 'IntersectionObserver' in window) {
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { links.forEach((a) => a.classList.remove('active')); map.get(e.target.id)?.classList.add('active'); }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); el && io.observe(el); });
  }

  // Copy citation
  const copyBtn = document.querySelector('[data-copy]');
  copyBtn && copyBtn.addEventListener('click', async () => {
    const text = document.querySelector(copyBtn.dataset.copy).innerText.trim();
    try { await navigator.clipboard.writeText(text); copyBtn.textContent = 'Citation copied'; }
    catch (e) { copyBtn.textContent = 'Select the text to copy'; }
    setTimeout(() => { copyBtn.textContent = 'Copy citation'; }, 2400);
  });
})();
