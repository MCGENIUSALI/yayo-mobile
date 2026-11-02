// Original, brand-free product renders for the YAYO demo catalogue.
// Each entry is an SVG (1000x1000) rendered to JPEG by render.js.

const bg = (id, a, b) => `
  <defs>
    <radialGradient id="${id}-bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </radialGradient>
    <radialGradient id="${id}-floor" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#${id}-bg)"/>`;

// Grille de haut-parleur : motif de petits trous.
const grille = (id, color, op = 0.35, step = 16, r = 3.2) => `
  <pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse">
    <circle cx="${step / 2}" cy="${step / 2}" r="${r}" fill="${color}" fill-opacity="${op}"/>
  </pattern>`;

module.exports = {
  /* Enceinte compacte jaune, format galet rectangulaire, dragonne. */
  'jbl-go-3': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg('go', '#fff6d6', '#f3d36b')}
  <defs>
    <linearGradient id="go-body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd84a"/><stop offset=".55" stop-color="#f2c230"/><stop offset="1" stop-color="#c99712"/>
    </linearGradient>
    <linearGradient id="go-fabric" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7cc3a"/><stop offset="1" stop-color="#dcaa1c"/>
    </linearGradient>
    ${grille('go-dots', '#7a5a00', 0.32, 15, 3)}
    <linearGradient id="go-shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <ellipse cx="500" cy="790" rx="300" ry="42" fill="url(#go-floor)"/>
  <!-- dragonne -->
  <g transform="rotate(-8 500 520)">
    <path d="M700 320 C 790 250, 860 330, 770 400" fill="none" stroke="#1c1c1e" stroke-width="22" stroke-linecap="round"/>
    <rect x="210" y="290" width="560" height="470" rx="120" fill="url(#go-body)"/>
    <rect x="250" y="330" width="480" height="390" rx="92" fill="url(#go-fabric)"/>
    <rect x="250" y="330" width="480" height="390" rx="92" fill="url(#go-dots)"/>
    <!-- passive radiator rond -->
    <circle cx="490" cy="525" r="128" fill="#e3b21f"/>
    <circle cx="490" cy="525" r="128" fill="none" stroke="#a87e05" stroke-width="10" stroke-opacity=".5"/>
    <circle cx="490" cy="525" r="74" fill="#f2c230" stroke="#b88a0a" stroke-opacity=".35" stroke-width="6"/>
    <!-- reflet -->
    <rect x="232" y="305" width="516" height="120" rx="70" fill="url(#go-shine)"/>
    <!-- boutons -->
    <rect x="420" y="262" width="150" height="30" rx="15" fill="#d9a915"/>
  </g>
</svg>`,

  /* Enceinte cylindrique bleue avec embouts noirs. */
  'jbl-charge-5': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg('ch', '#eef4ff', '#a9c6f2')}
  <defs>
    <linearGradient id="ch-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6ea8f5"/><stop offset=".35" stop-color="#2f7be5"/><stop offset="1" stop-color="#174a9c"/>
    </linearGradient>
    ${grille('ch-dots', '#0b2a5c', 0.35, 14, 2.8)}
    <linearGradient id="ch-cap" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3a3a3f"/><stop offset="1" stop-color="#121214"/>
    </linearGradient>
    <linearGradient id="ch-shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <ellipse cx="500" cy="720" rx="380" ry="40" fill="url(#ch-floor)"/>
  <!-- socle -->
  <rect x="300" y="650" width="400" height="44" rx="22" fill="#1c1c1e"/>
  <!-- corps -->
  <rect x="150" y="330" width="700" height="340" rx="170" fill="url(#ch-body)"/>
  <rect x="150" y="330" width="700" height="340" rx="170" fill="url(#ch-dots)"/>
  <!-- embouts -->
  <ellipse cx="190" cy="500" rx="70" ry="170" fill="url(#ch-cap)"/>
  <ellipse cx="190" cy="500" rx="42" ry="120" fill="#2a2a2e" stroke="#4a4a50" stroke-width="6"/>
  <ellipse cx="810" cy="500" rx="70" ry="170" fill="url(#ch-cap)"/>
  <ellipse cx="810" cy="500" rx="42" ry="120" fill="#2a2a2e" stroke="#4a4a50" stroke-width="6"/>
  <!-- reflet -->
  <rect x="250" y="345" width="500" height="90" rx="45" fill="url(#ch-shine)"/>
  <!-- boutons -->
  <g fill="#103a7d" opacity=".9">
    <circle cx="430" cy="318" r="12"/><circle cx="470" cy="318" r="12"/><circle cx="530" cy="318" r="12"/><circle cx="570" cy="318" r="12"/>
  </g>
</svg>`,

  /* Casque arceau noir. */
  'jbl-tune-510': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg('hp', '#f4f4f6', '#c9c9d0')}
  <defs>
    <linearGradient id="hp-band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a3a40"/><stop offset="1" stop-color="#121214"/>
    </linearGradient>
    <radialGradient id="hp-cup" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#4a4a52"/><stop offset=".6" stop-color="#1d1d1f"/><stop offset="1" stop-color="#0a0a0b"/>
    </radialGradient>
    <radialGradient id="hp-pad" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="#2e2e33"/><stop offset="1" stop-color="#0d0d0f"/>
    </radialGradient>
  </defs>
  <ellipse cx="500" cy="840" rx="340" ry="40" fill="url(#hp-floor)"/>
  <!-- arceau -->
  <path d="M250 560 C 240 230, 760 230, 750 560" fill="none" stroke="url(#hp-band)" stroke-width="58" stroke-linecap="round"/>
  <path d="M285 470 C 300 290, 700 290, 715 470" fill="none" stroke="#5a5a62" stroke-width="10" stroke-linecap="round" opacity=".55"/>
  <!-- tiges -->
  <rect x="226" y="520" width="44" height="120" rx="20" fill="#2a2a2f"/>
  <rect x="730" y="520" width="44" height="120" rx="20" fill="#2a2a2f"/>
  <!-- oreillettes -->
  <g>
    <ellipse cx="250" cy="680" rx="118" ry="150" fill="url(#hp-pad)"/>
    <ellipse cx="236" cy="676" rx="94" ry="126" fill="url(#hp-cup)"/>
    <ellipse cx="216" cy="630" rx="34" ry="46" fill="#fff" opacity=".08"/>
  </g>
  <g>
    <ellipse cx="750" cy="680" rx="118" ry="150" fill="url(#hp-pad)"/>
    <ellipse cx="764" cy="676" rx="94" ry="126" fill="url(#hp-cup)"/>
    <ellipse cx="744" cy="630" rx="34" ry="46" fill="#fff" opacity=".08"/>
  </g>
</svg>`,

  /* Écouteurs sans fil orange dans leur boîtier ouvert. */
  'earbuds-pro': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg('eb', '#fff1e3', '#f6b97f')}
  <defs>
    <linearGradient id="eb-case" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffa04a"/><stop offset=".6" stop-color="#fb7800"/><stop offset="1" stop-color="#c85800"/>
    </linearGradient>
    <linearGradient id="eb-lid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb46b"/><stop offset="1" stop-color="#f07200"/>
    </linearGradient>
    <radialGradient id="eb-bud" cx="38%" cy="32%" r="70%">
      <stop offset="0" stop-color="#ffc58f"/><stop offset=".55" stop-color="#fb7800"/><stop offset="1" stop-color="#b95100"/>
    </radialGradient>
  </defs>
  <ellipse cx="470" cy="800" rx="330" ry="40" fill="url(#eb-floor)"/>
  <!-- couvercle ouvert -->
  <path d="M250 430 C 250 300, 650 300, 650 430 Z" fill="url(#eb-lid)"/>
  <path d="M262 428 L 638 428" stroke="#b55100" stroke-width="8" stroke-opacity=".35"/>
  <!-- boîtier -->
  <rect x="240" y="430" width="420" height="340" rx="150" fill="url(#eb-case)"/>
  <rect x="270" y="440" width="360" height="70" rx="35" fill="#b85400" opacity=".55"/>
  <circle cx="450" cy="700" r="9" fill="#fff" opacity=".85"/>
  <!-- écouteur posé -->
  <g transform="translate(700 600) rotate(18)">
    <rect x="-22" y="0" width="44" height="170" rx="22" fill="url(#eb-bud)"/>
    <ellipse cx="0" cy="-8" rx="74" ry="66" fill="url(#eb-bud)"/>
    <ellipse cx="-34" cy="-14" rx="30" ry="26" fill="#3a1b00" opacity=".65"/>
    <ellipse cx="18" cy="-34" rx="20" ry="12" fill="#fff" opacity=".35"/>
  </g>
  <!-- écouteur dans le boîtier -->
  <g transform="translate(380 470)">
    <ellipse cx="0" cy="0" rx="58" ry="46" fill="url(#eb-bud)"/>
    <ellipse cx="14" cy="-14" rx="16" ry="9" fill="#fff" opacity=".35"/>
  </g>
</svg>`,
};
