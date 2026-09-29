/* ==========================================================================
   View — reusable markup: lanterns, emblems, ornaments, skyline, pagoda scene.
   Pure functions returning HTML/SVG strings (no state, no listeners).
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { U } = TDG;

  /* Stupa silhouette path (platform steps, bell, spire). */
  function stupaPath(cx, baseY, h) {
    const w = h * 0.62;
    const p = (dx, dy) => `${(cx + dx * w).toFixed(1)} ${(baseY - dy * h).toFixed(1)}`;
    return `M${p(-0.5, 0)} L${p(-0.5, 0.06)} L${p(-0.42, 0.06)} L${p(-0.42, 0.12)} L${p(-0.34, 0.12)} `
      + `Q${p(-0.33, 0.36)} ${p(-0.13, 0.46)} L${p(-0.08, 0.5)} L${p(-0.08, 0.56)} `
      + `Q${p(-0.03, 0.78)} ${p(0, 1)} Q${p(0.03, 0.78)} ${p(0.08, 0.56)} `
      + `L${p(0.08, 0.5)} L${p(0.13, 0.46)} Q${p(0.33, 0.36)} ${p(0.34, 0.12)} `
      + `L${p(0.42, 0.12)} L${p(0.42, 0.06)} L${p(0.5, 0.06)} L${p(0.5, 0)} Z`;
  }

  /* Toddy palm — the silhouette of central Myanmar. */
  function palm(x, baseY, h, fill) {
    const top = baseY - h;
    let fronds = '';
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      const len = h * 0.26;
      const ex = x + Math.cos(a) * len;
      const ey = top + Math.sin(a) * len * 0.75 + len * 0.18;
      fronds += `<path d="M${x} ${top} Q${(x + ex) / 2} ${top - len * 0.35} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${fill}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }
    return `<path d="M${x - 1.6} ${baseY} Q${x - 3} ${baseY - h * 0.5} ${x - 0.8} ${top} L${x + 0.8} ${top} Q${x - 1} ${baseY - h * 0.5} ${x + 1.6} ${baseY} Z" fill="${fill}"/>`
      + `<circle cx="${x}" cy="${top}" r="${h * 0.05}" fill="${fill}"/>` + fronds;
  }

  const View = {
    stupaPath,

    /* Paper lantern. state: dark | lit | burnt. variant: rose | jade | azure | golden */
    lantern({ state = 'lit', variant = '', size = 60, cls = '', style = '', attrs = '', tag = 'button', hang = false, timed = false } = {}) {
      const type = tag === 'button' ? ' type="button"' : '';
      return `<${tag}${type} class="lantern ${state}${variant ? ' v-' + variant : ''} ${cls}" style="--w:${size}px;${style}" ${attrs}>`
        + (timed ? '<span class="l-life"></span>' : '')
        + '<span class="l-inner">'
        + (hang ? '<span class="l-string"></span>' : '')
        + '<span class="l-glow"></span><span class="l-hook"></span><span class="l-cap top"></span>'
        + '<span class="l-body"></span><span class="l-cap bot"></span><span class="l-tassel"></span>'
        + (state === 'burnt' ? '<span class="l-crack"></span><span class="l-smoke"></span>' : '')
        + `</span></${tag}>`;
    },

    /* Myanmar-inspired divider: scrolling vines around a lotus-diamond. */
    ornament(cls = '') {
      const side = '<path d="M4 12 H58 M58 12 C66 12 70 5 78 5 C85 5 88 11 84 14 C81 16 77 13 79 10 M58 12 C66 12 70 19 78 19 C83 19 86 16 85 13" />'
        + '<circle cx="46" cy="12" r="1.6"/><circle cx="34" cy="12" r="1.1"/>';
      return `<svg class="ornament ${cls}" viewBox="0 0 220 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">`
        + `<g>${side}</g><g transform="translate(220 0) scale(-1 1)">${side}</g>`
        + '<path d="M110 2 L118 12 L110 22 L102 12 Z" fill="currentColor" fill-opacity=".18"/>'
        + '<path d="M110 6 L114 12 L110 18 L106 12 Z" fill="currentColor" stroke="none"/>'
        + '<path d="M96 12 C100 8 102 8 102 12 M124 12 C120 8 118 8 118 12" /></svg>';
    },

    /* Tier medallions. */
    emblem(tierId, size = 72) {
      const ring = (c) => `<circle cx="40" cy="40" r="36" fill="url(#em-bg)" stroke="${c}" stroke-width="1.5"/>`
        + `<circle cx="40" cy="40" r="31" fill="none" stroke="${c}" stroke-opacity=".45" stroke-width="1" stroke-dasharray="2 3"/>`;
      let inner = '';
      switch (tierId) {
        case 'golden-pagoda':
          inner = ring('#f5c060') + '<circle cx="40" cy="44" r="22" fill="url(#em-halo)"/>'
            + `<path d="${stupaPath(40, 62, 46)}" fill="url(#em-gold)"/>`
            + '<circle cx="40" cy="14.5" r="1.8" fill="#fff4d0"/>';
          break;
        case 'golden-lantern':
          inner = ring('#f5c060') + '<circle cx="40" cy="42" r="22" fill="url(#em-halo)"/>'
            + '<rect x="39.3" y="12" width="1.4" height="8" fill="#c99040"/>'
            + '<rect x="32" y="19" width="16" height="4" rx="1.5" fill="#e3b458"/>'
            + '<ellipse cx="40" cy="39" rx="15" ry="16" fill="url(#em-gold)"/>'
            + '<path d="M33 25 Q29 39 33 53 M40 23 V55 M47 25 Q51 39 47 53" stroke="#9b5d18" stroke-opacity=".5" fill="none"/>'
            + '<rect x="32" y="54" width="16" height="4" rx="1.5" fill="#e3b458"/>'
            + '<path d="M40 58 V67" stroke="#c43b2e" stroke-width="2"/>';
          break;
        case 'festival-light':
          inner = ring('#ff9f43') + '<circle cx="40" cy="36" r="20" fill="url(#em-halo)"/>'
            + '<path d="M40 16 C47 26 49 32 44.5 40 C43 42.5 37 42.5 35.5 40 C31 32 33 26 40 16 Z" fill="url(#em-flame)"/>'
            + '<path d="M40 27 C43 32 43.5 35 41.5 38.5 C40.8 39.5 39.2 39.5 38.5 38.5 C36.5 35 37 32 40 27 Z" fill="#fff6d8"/>'
            + '<path d="M22 45 H58 C56 55 49 60 40 60 C31 60 24 55 22 45 Z" fill="url(#em-copper)"/>'
            + '<rect x="37" y="41" width="6" height="5" fill="#6e4415"/>';
          break;
        default:
          inner = ring('#c98a4a')
            + '<rect x="39.3" y="14" width="1.4" height="8" fill="#9a6a38"/>'
            + '<rect x="33" y="21" width="14" height="3.5" rx="1.5" fill="#b77d3f"/>'
            + '<ellipse cx="40" cy="39" rx="13" ry="14" fill="url(#em-copper)"/>'
            + '<path d="M34 27 Q31 39 34 51 M40 25 V53 M46 27 Q49 39 46 51" stroke="#5e3410" stroke-opacity=".45" fill="none"/>'
            + '<rect x="33" y="52" width="14" height="3.5" rx="1.5" fill="#b77d3f"/>'
            + '<path d="M40 55.5 V64" stroke="#a8392d" stroke-width="2"/>';
      }
      return `<svg class="emblem" viewBox="0 0 80 80" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
    },

    lockEmblem(size = 72) {
      return `<svg class="emblem locked" viewBox="0 0 80 80" width="${size}" height="${size}" aria-hidden="true">`
        + '<circle cx="40" cy="40" r="36" fill="url(#em-bg)" stroke="rgba(245,192,96,.35)" stroke-width="1.5" stroke-dasharray="3 4"/>'
        + '<rect x="29" y="38" width="22" height="17" rx="3" fill="none" stroke="rgba(246,236,216,.5)" stroke-width="2"/>'
        + '<path d="M33 38 V32 a7 7 0 0 1 14 0 V38" fill="none" stroke="rgba(246,236,216,.5)" stroke-width="2"/></svg>';
    },

    /* Background horizon: hills, stupas, palms, twinkling candle rows. */
    skyline() {
      const far = '#0e1238', mid = '#0a0d2c', near = '#060820';
      let lights = '';
      const row = (x0, x1, y, step, cls = '') => {
        for (let x = x0; x <= x1; x += step) {
          lights += `<circle class="sk-light ${cls}" cx="${x}" cy="${y}" r="0.9" style="animation-delay:${(Math.random() * 3).toFixed(2)}s"/>`;
        }
      };
      row(166, 234, 128.5, 4.5);
      row(176, 224, 121.5, 5, 'b');
      row(82, 108, 132, 4, 'b');
      row(292, 318, 133, 4);
      row(12, 60, 137, 6, 'b');
      row(340, 392, 137, 6);
      return '<svg class="skyline-svg" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true">'
        + `<path d="M0 104 Q40 92 80 100 T160 96 T240 100 T320 94 T400 102 V140 H0 Z" fill="${far}"/>`
        + `<path d="${stupaPath(40, 106, 34)}" fill="${far}"/><path d="${stupaPath(352, 104, 40)}" fill="${far}"/>`
        + `<path d="${stupaPath(262, 100, 26)}" fill="${far}"/>`
        + `<path d="M0 124 Q60 112 120 120 T240 118 T400 122 V140 H0 Z" fill="${mid}"/>`
        + `<path d="${stupaPath(200, 130, 96)}" fill="${mid}"/>`
        + `<path d="${stupaPath(95, 133, 58)}" fill="${mid}"/><path d="${stupaPath(305, 134, 52)}" fill="${mid}"/>`
        + palm(140, 134, 44, near) + palm(152, 136, 34, near) + palm(262, 136, 40, near) + palm(378, 138, 50, near)
        + `<path d="M0 134 Q100 128 200 133 T400 132 V140 H0 Z" fill="${near}"/>`
        + `<g class="sk-lights">${lights}</g></svg>`;
    },

    /* Stage 6 scene. Each group has a dark layer and a lit layer. */
    pagodaScene() {
      const VB_Y = 60;   // crop empty sky so the scene fills phone screens
      const VB_H = 340;
      const mode = (L) => ({
        L,
        gold: L ? 'url(#pg-gold)' : '#161a44',
        stroke: L ? '#8a5b1c' : '#262b6a',
        warm: L ? '#ffd27d' : '#1b1f4d',
        warm2: L ? '#ff9f4a' : '#1d2150',
        wall: L ? '#35213a' : '#10133a',
        win: L ? '#ffcf73' : '#0b0d28',
        post: L ? '#6d4a24' : '#141738',
      });

      const lamps = (xs) => (c) => xs.map((x) => `<rect x="${x - 1}" y="370" width="2" height="30" fill="${c.post}"/>`
        + `<rect x="${x - 5}" y="355" width="10" height="2.6" rx="1" fill="${c.L ? '#e9b660' : '#1c2050'}"/>`
        + `<ellipse cx="${x}" cy="365" rx="7" ry="9" fill="${c.warm2}"/>`
        + `<ellipse cx="${x}" cy="364" rx="3.2" ry="5" fill="${c.L ? '#fff1c2' : '#1b1f4d'}"/>`
        + `<rect x="${x - 4}" y="373" width="8" height="2" rx="1" fill="${c.L ? '#e9b660' : '#1c2050'}"/>`).join('');

      const house = (c) => `<rect x="12" y="306" width="56" height="54" fill="${c.wall}" stroke="${c.stroke}" stroke-width=".8"/>`
        + `<polygon points="4,308 76,308 62,288 18,288" fill="${c.gold}"/>`
        + `<polygon points="16,290 64,290 54,274 26,274" fill="${c.gold}"/>`
        + `<polygon points="28,276 52,276 44,262 36,262" fill="${c.gold}"/>`
        + `<polygon points="38,264 42,264 40,246" fill="${c.gold}"/>`
        + `<rect x="20" y="318" width="11" height="13" rx="1" fill="${c.win}"/>`
        + `<rect x="49" y="318" width="11" height="13" rx="1" fill="${c.win}"/>`
        + `<rect x="34" y="330" width="12" height="30" rx="1" fill="${c.L ? '#d99a4e' : '#0b0d28'}"/>`;

      const strand = (x0, y0, cx, cy, x1, y1, c) => {
        let s = `<path d="M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}" stroke="${c.L ? '#8a6a3a' : '#1f2358'}" stroke-width=".8" fill="none"/>`;
        for (let i = 1; i < 10; i++) {
          const t = i / 10;
          const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
          const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1 + 2;
          s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="${c.L ? (i % 2 ? '#ffd27a' : '#ff8f5a') : '#232757'}"/>`;
        }
        return s;
      };

      const base = (c) => {
        let s = `<rect x="72" y="344" width="156" height="16" fill="${c.gold}"/>`
          + `<rect x="88" y="330" width="124" height="14" fill="${c.gold}"/>`
          + `<rect x="104" y="318" width="92" height="12" fill="${c.gold}"/>`;
        for (let x = 80; x <= 220; x += 10) s += `<circle cx="${x}" cy="352" r="2" fill="${c.L ? '#fff0b8' : '#1f2250'}"/>`;
        for (let x = 96; x <= 204; x += 12) s += `<circle cx="${x}" cy="337" r="1.8" fill="${c.L ? '#fff0b8' : '#1f2250'}"/>`;
        return s;
      };

      const bell = (c) => `<path d="M106 318 C106 300 112 292 118 280 C124 262 136 250 150 246 C164 250 176 262 182 280 C188 292 194 300 194 318 Z" fill="${c.gold}"/>`
        + `<rect x="112" y="304" width="76" height="3" fill="${c.L ? '#fff0c4' : '#1d2257'}" opacity=".7"/>`
        + `<rect x="130" y="238" width="40" height="9" rx="2" fill="${c.gold}"/>`
        + `<path d="M128 238 C134 226 166 226 172 238 Z" fill="${c.gold}"/>`;

      const spire = (c) => {
        let s = `<path d="M134 228 Q150 214 166 228 Z" fill="${c.gold}"/>`
          + `<path d="M140 224 C144 196 148 176 150 150 C152 176 156 196 160 224 Z" fill="${c.gold}"/>`;
        for (let i = 0; i < 5; i++) {
          const y = 146 - i * 6;
          const w = 16 - i * 2.4;
          s += `<polygon points="${150 - w / 2},${y + 5} ${150 + w / 2},${y + 5} ${150 + w / 2 - 2},${y} ${150 - w / 2 + 2},${y}" fill="${c.gold}"/>`;
        }
        s += `<rect x="149.2" y="104" width="1.6" height="14" fill="${c.gold}"/>`
          + `<circle cx="150" cy="102" r="3" fill="${c.L ? '#fffbe6' : '#1d2257'}"/>`;
        return s;
      };

      const GROUPS = [
        { g: 'lampsL', x: 40, y: 366, draw: lamps([16, 40, 64]) },
        { g: 'lampsR', x: 260, y: 366, draw: lamps([236, 260, 284]) },
        { g: 'houseL', x: 40, y: 322, draw: house },
        { g: 'houseR', x: 260, y: 322, draw: (c) => `<g transform="translate(300 0) scale(-1 1)">${house(c)}</g>` },
        { g: 'strings', x: 78, y: 287, draw: (c) => strand(42, 256, 80, 300, 112, 292, c) + strand(258, 256, 220, 300, 188, 292, c) },
        { g: 'base', x: 150, y: 340, draw: base },
        { g: 'bell', x: 150, y: 282, draw: bell },
        { g: 'spire', x: 150, y: 172, draw: spire },
      ];

      const groupSvg = GROUPS.map((G) => `<g class="pg" data-g="${G.g}"><g class="pg-d">${G.draw(mode(false))}</g>`
        + `<g class="pg-l" filter="url(#pg-glow)">${G.draw(mode(true))}</g></g>`).join('');

      let sky = '';
      for (let i = 0; i < 14; i++) {
        sky += `<circle cx="${U.rand(14, 286).toFixed(0)}" cy="${U.rand(74, 210).toFixed(0)}" r="${U.rand(1.2, 2.6).toFixed(1)}" fill="#ffc374"/>`;
      }

      const svg = `<svg class="pg-svg" viewBox="0 ${VB_Y} 300 ${VB_H}" aria-hidden="true">`
        + '<defs>'
        + '<linearGradient id="pg-gold" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#9a5f1c"/><stop offset=".35" stop-color="#f3c464"/><stop offset=".5" stop-color="#fff0bf"/><stop offset=".68" stop-color="#e9ad48"/><stop offset="1" stop-color="#8a5418"/></linearGradient>'
        + '<radialGradient id="pg-halo"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".55"/><stop offset=".5" stop-color="#ff9a3c" stop-opacity=".16"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>'
        + '<filter id="pg-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
        + '</defs>'
        + '<circle class="pg-halo" cx="150" cy="250" r="160" fill="url(#pg-halo)"/>'
        + '<circle class="pg-moon" cx="244" cy="98" r="15" fill="#f6e7c1"/>'
        + `<g class="pg-sky">${sky}</g>`
        // ground + hills run far past the box (svg overflow: visible) so wide screens see no edges
        + '<path d="M-900 318 Q-400 300 0 316 Q50 296 100 308 T200 302 T300 310 Q700 298 1200 318 V360 H-900 Z" fill="#0c0f30"/>'
        + '<path d="M-900 360 H1200 V700 H-900 Z" fill="#080a24"/>'
        + groupSvg
        + '</svg>';

      // Anchors are returned as % of the cropped scene box.
      return {
        svg,
        aspect: 300 / VB_H,
        anchors: GROUPS.map(({ g, x, y }) => ({ g, left: (x / 300) * 100, top: ((y - VB_Y) / VB_H) * 100 })),
      };
    },
  };

  TDG.View = View;
})(window.TDG);
