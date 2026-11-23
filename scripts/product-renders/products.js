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
  /* Chaussures de sport en toile, blanc et orange. */
  'chaussures-sport': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg('sn', '#fff1e3', '#f6c28e')}
  <defs>
    <linearGradient id="sn-upper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e4e4e8"/>
    </linearGradient>
    <linearGradient id="sn-sole" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fb7800"/><stop offset="1" stop-color="#c85d00"/>
    </linearGradient>
  </defs>
  <ellipse cx="500" cy="760" rx="380" ry="40" fill="url(#sn-floor)"/>
  <g transform="rotate(-6 500 560)">
    <!-- semelle -->
    <path d="M130 640 C 130 700, 200 720, 300 720 L 820 720 C 890 720, 900 650, 860 620 L 150 610 Z" fill="url(#sn-sole)"/>
    <path d="M140 650 L 870 650" stroke="#fff" stroke-width="10" opacity=".6"/>
    <!-- tige -->
    <path d="M150 615 C 150 520, 240 470, 330 450 L 470 330 C 520 300, 580 310, 610 360 L 680 470 C 760 490, 850 520, 870 620 Z" fill="url(#sn-upper)"/>
    <!-- talon -->
    <path d="M150 615 C 150 540, 190 490, 250 470 L 260 615 Z" fill="#1c1c1e"/>
    <!-- swoosh générique -->
    <path d="M300 570 C 420 600, 600 560, 760 520" fill="none" stroke="#fb7800" stroke-width="26" stroke-linecap="round"/>
    <!-- lacets -->
    <g stroke="#1c1c1e" stroke-width="12" stroke-linecap="round">
      <path d="M470 370 L 540 410"/><path d="M500 340 L 570 380"/><path d="M445 400 L 515 440"/><path d="M530 315 L 590 350"/>
    </g>
    <!-- languette -->
    <path d="M520 300 C 560 250, 620 260, 640 300 L 600 360 Z" fill="#f2f2f4" stroke="#d0d0d6" stroke-width="4"/>
    <path d="M330 450 C 360 480, 380 520, 380 560" fill="none" stroke="#d0d0d6" stroke-width="6"/>
  </g>
</svg>`,

  /* Pot de beurre de karité ouvert. */
  'beurre-karite': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg('ka', '#fbf5ea', '#e6cfa6')}
  <defs>
    <linearGradient id="ka-jar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7a4a1e"/><stop offset=".45" stop-color="#b9783a"/><stop offset="1" stop-color="#6a3e17"/>
    </linearGradient>
    <radialGradient id="ka-cream" cx="45%" cy="40%" r="60%">
      <stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#efe0c2"/>
    </radialGradient>
    <linearGradient id="ka-lid" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#2a2a2e"/><stop offset=".5" stop-color="#4a4a52"/><stop offset="1" stop-color="#1c1c1e"/>
    </linearGradient>
  </defs>
  <ellipse cx="500" cy="790" rx="360" ry="38" fill="url(#ka-floor)"/>
  <!-- couvercle posé -->
  <g transform="translate(730 690) rotate(-12)">
    <ellipse cx="0" cy="40" rx="150" ry="40" fill="#121214"/>
    <rect x="-150" y="-10" width="300" height="50" fill="url(#ka-lid)"/>
    <ellipse cx="0" cy="-10" rx="150" ry="40" fill="#3a3a40"/>
  </g>
  <!-- pot -->
  <path d="M250 430 L 250 700 C 250 760, 650 760, 650 700 L 650 430 Z" fill="url(#ka-jar)"/>
  <ellipse cx="450" cy="430" rx="200" ry="56" fill="#8a5424"/>
  <ellipse cx="450" cy="438" rx="180" ry="46" fill="url(#ka-cream)"/>
  <path d="M380 430 C 420 400, 470 470, 520 425" fill="none" stroke="#e2cfa8" stroke-width="10" stroke-linecap="round"/>
  <!-- étiquette -->
  <rect x="300" y="540" width="300" height="120" rx="14" fill="#fff4e6"/>
  <rect x="330" y="575" width="160" height="16" rx="8" fill="#db6200"/>
  <rect x="330" y="607" width="220" height="12" rx="6" fill="#c9b08a"/>
  <!-- feuilles -->
  <path d="M180 760 C 150 690, 210 640, 260 660 C 250 720, 220 750, 180 760 Z" fill="#5f8a3a"/>
  <path d="M190 755 C 210 710, 230 690, 255 665" stroke="#3f6626" stroke-width="5" fill="none"/>
</svg>`,

  /* Lampe solaire de table, panneau sur le dessus. */
  'lampe-solaire': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg('lp', '#f1f6ee', '#b8cfa9')}
  <defs>
    <radialGradient id="lp-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff6c8"/><stop offset=".55" stop-color="#ffd76a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lp-body" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1c1c1e"/><stop offset=".5" stop-color="#3a3a40"/><stop offset="1" stop-color="#121214"/>
    </linearGradient>
    <pattern id="lp-cells" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="38" height="38" fill="#1f3f7a"/><path d="M0 19 H40 M19 0 V40" stroke="#5f86c9" stroke-width="2"/>
    </pattern>
  </defs>
  <ellipse cx="500" cy="800" rx="300" ry="36" fill="url(#lp-floor)"/>
  <circle cx="500" cy="540" r="300" fill="url(#lp-glow)"/>
  <!-- poignée -->
  <path d="M400 290 C 400 200, 600 200, 600 290" fill="none" stroke="#1c1c1e" stroke-width="22" stroke-linecap="round"/>
  <!-- panneau solaire -->
  <path d="M330 300 L 670 300 L 640 360 L 360 360 Z" fill="url(#lp-cells)" stroke="#121214" stroke-width="8"/>
  <!-- globe -->
  <rect x="370" y="360" width="260" height="320" rx="40" fill="#fff3c4" opacity=".92"/>
  <rect x="370" y="360" width="260" height="320" rx="40" fill="none" stroke="#e8c45a" stroke-width="6"/>
  <g stroke="#e3b94a" stroke-width="5" opacity=".7"><path d="M420 370 V 670"/><path d="M500 370 V 670"/><path d="M580 370 V 670"/></g>
  <circle cx="500" cy="520" r="54" fill="#fffbe8"/>
  <!-- socle -->
  <rect x="350" y="680" width="300" height="90" rx="20" fill="url(#lp-body)"/>
  <circle cx="600" cy="725" r="12" fill="#00957a"/>
</svg>`,

  /* Batterie externe noire avec indicateur LED. */
  'batterie-externe': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg('pb', '#f2f2f6', '#bfc3cf')}
  <defs>
    <linearGradient id="pb-body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4a4a52"/><stop offset=".5" stop-color="#26262b"/><stop offset="1" stop-color="#0d0d0f"/>
    </linearGradient>
    <linearGradient id="pb-shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <ellipse cx="500" cy="790" rx="320" ry="36" fill="url(#pb-floor)"/>
  <g transform="rotate(-14 500 520)">
    <rect x="300" y="240" width="400" height="560" rx="56" fill="url(#pb-body)"/>
    <rect x="320" y="260" width="360" height="160" rx="44" fill="url(#pb-shine)"/>
    <!-- LED -->
    <g fill="#00957a"><circle cx="440" cy="700" r="12"/><circle cx="480" cy="700" r="12"/><circle cx="520" cy="700" r="12"/></g>
    <circle cx="560" cy="700" r="12" fill="#3a3a40"/>
    <!-- ports -->
    <rect x="410" y="226" width="70" height="22" rx="8" fill="#0a0a0b"/>
    <rect x="510" y="226" width="80" height="22" rx="6" fill="#0a0a0b"/>
    <!-- éclair -->
    <path d="M520 420 L 450 540 L 500 540 L 470 640 L 560 500 L 505 500 L 540 420 Z" fill="#fb7800"/>
  </g>
  <!-- câble -->
  <path d="M620 260 C 700 160, 820 220, 800 360 C 790 440, 860 470, 900 450" fill="none" stroke="#e8e8ec" stroke-width="18" stroke-linecap="round"/>
</svg>`,
};
