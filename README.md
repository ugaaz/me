# ugaaz.com

Personal site of Ugaaz Arafat (Arafat Abdullahi Ali): venture builder in Mogadishu and Nairobi.
Static HTML, CSS and JS. No build step. Deploy the branch contents to `public_html`.

- `index.html` — landing page with the 3D globe hero and WhatsApp CTA
- `research/` — research hub and study pages
- `assets/js/globe.js` — Three.js globe (vendored `three.module.min.js`, land dots in `assets/data/land.bin`)
- `assets/js/site.js` — theme, navigation, WhatsApp links and project form (number set in `WA`)
- `assets/js/study.js` — charts and data explorer for the government website study

Local preview: `python3 -m http.server 8080`, then open http://localhost:8080
