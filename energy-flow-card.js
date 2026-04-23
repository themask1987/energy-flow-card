// =============================================================================
// ENERGY FLOW CARD — energy-flow-card.js  v1.3.2
// Repository: github.com/themask1987/energy-flow-card
// =============================================================================

const CARD_VERSION = '1.3.2';

const VB = { w: 700, h: 760 };

const POS = {
  solar   : { x: 175, y: 210 },
  battery : { x: 525, y: 210 },
  grid    : { x: 175, y: 520 },
  home    : { x: 525, y: 520 },
};

const STR_SLOTS  = [1, 2, 0, 3];
const LOAD_SLOTS = [2, 1, 3, 0, 4];

const STR_SLOT_X  = [8, 178, 348, 518];
const STR_BOX_W   = 164;
const STR_BOX_H   = 58;
const STR_Y       = 5;

const LOAD_SLOT_X = [15, 150, 285, 420, 555];
const LOAD_BOX_W  = 130;
const LOAD_BOX_H  = 58;
const LOAD_Y      = 638;

const DEFAULT_COLORS = {
  solar   : { stroke: '#F9A825', fill: '#1e1400' },
  battery : { stroke: '#E91E63', fill: '#1a0020' },
  grid    : { stroke: '#42A5F5', fill: '#001533' },
  home    : { stroke: '#EF5350', fill: '#1a0500' },
};

// =============================================================================
// Config resolvers
// =============================================================================

function resolveAppearance(cfg) {
  const a = cfg.appearance || {};
  return {
    nodeRadius          : parseInt(a.node_radius)             || 77,
    dotSize             : parseInt(a.dot_size)                || 6,
    dotSpeed            : a.dot_speed === 'auto' || !a.dot_speed ? 'auto' : parseFloat(a.dot_speed),
    glowIntensity       : parseFloat(a.glow_intensity)        || 0.08,
    glowSpeed           : parseFloat(a.glow_speed)            || 2.8,
    lineWidth           : parseFloat(a.line_width)            || 2.5,
    lineOpacityInactive : parseFloat(a.line_opacity_inactive) || 0.15,
    flowThreshold       : parseInt(a.flow_threshold)          || 10,
    fontNodeLabel       : parseInt(a.font_node_label)         || 19,
    fontNodeValue       : parseInt(a.font_node_value)         || 31,
    fontNodeSecondary   : parseInt(a.font_node_secondary)     || 15,
    fontSecLabel        : parseInt(a.font_secondary_label)    || 14,
    fontSecValue        : parseInt(a.font_secondary_value)    || 19,
  };
}

function resolveColors(cfg) {
  const c = cfg.colors || {};
  const merge = (key) => ({
    stroke: c[key]?.stroke || DEFAULT_COLORS[key].stroke,
    fill  : c[key]?.fill   || DEFAULT_COLORS[key].fill,
    glow  : c[key]?.stroke || DEFAULT_COLORS[key].stroke,
  });
  return {
    solar   : merge('solar'),
    battery : merge('battery'),
    grid    : merge('grid'),
    home    : merge('home'),
  };
}

function resolveDisplay(cfg) {
  const v = cfg.display || {};
  return {
    showGrid        : v.show_grid           !== false,
    showBattery     : v.show_battery        !== false,
    showStrings     : v.show_strings        !== false,
    showLoads       : v.show_loads          !== false,
    showHistoryBtn  : v.show_history_button !== false,
  };
}

// =============================================================================
// Utility
// =============================================================================

function getW(hass, entityId, unitHint) {
  if (!entityId || !hass) return null;
  const s = hass.states[entityId];
  if (!s) return null;
  const v = parseFloat(s.state);
  if (isNaN(v)) return null;
  const unit = unitHint || s.attributes?.unit_of_measurement || '';
  return unit === 'kW' ? v * 1000 : v;
}

function getRaw(hass, entityId) {
  if (!entityId || !hass) return null;
  const s = hass.states[entityId];
  return s ? parseFloat(s.state) : null;
}

function fmtW(w) {
  if (w === null || w === undefined || isNaN(w)) return '—';
  const a = Math.abs(w);
  if (a >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

function fmtE(v) {
  if (v === null || isNaN(v)) return '—';
  return `${parseFloat(v).toFixed(1)} kWh`;
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function flowDur(w, app) {
  if (app.dotSpeed !== 'auto') return app.dotSpeed.toFixed(2);
  const w500 = Math.abs(w) / 500;
  const dur  = Math.max(0.5, 3.0 - w500 * 0.5);
  return dur.toFixed(2);
}

function isActive(w, thr) { return w !== null && !isNaN(w) && Math.abs(w) > thr; }
function isActiveValue(v, thr, mode) {
  if (v === null || v === undefined || isNaN(v)) return false;
  return mode === 'realtime' ? Math.abs(v) > thr : v > 0;
}

// =============================================================================
// SVG generators
// =============================================================================

function buildDefs(app, cols) {
  const sd = (app.glowIntensity * 120).toFixed(0);
  return `<defs>
  <filter id="efc-gs" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="${sd}" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="efc-gg" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="${sd}" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="efc-gh" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="${Math.round(sd*1.2)}" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="efc-gb" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="${sd}" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="efc-dot-glow" x="-150%" y="-150%" width="400%" height="400%">
    <feGaussianBlur stdDeviation="3" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>`;
}

function buildCSS(app) {
  const gi = app.glowIntensity;
  const gs = app.glowSpeed;
  const ds = app.dotSize;
  return `<style>
  :host { display:block; }
  ha-card { padding:8px 10px; box-sizing:border-box; background:#0e0e14 !important; border-radius:12px; }
  svg.efc-svg { width:100%; height:auto; display:block; }
  @keyframes efc-gp { 0%,100%{opacity:${(gi*0.5).toFixed(3)}} 50%{opacity:${(gi*2.5).toFixed(3)}} }
  @keyframes efc-da { to{stroke-dashoffset:-18} }
  @keyframes efc-fd {
    0%  {offset-distance:0%;  opacity:0}
    8%  {opacity:.9}
    88% {opacity:.9}
    100%{offset-distance:100%;opacity:0}
  }
  .efc-gr  { animation:efc-gp ${gs}s ease-in-out infinite; }
  .efc-da  { animation:efc-da .7s linear infinite; }
  .efc-dot { animation:efc-fd 1.5s linear infinite; offset-rotate:0deg; will-change:offset-distance,opacity; r:${ds}px; }
  .efc-d2  { animation-delay:-.5s; }
  .efc-d3  { animation-delay:-1s; }
  .efc-node { cursor:pointer; }
  .efc-mode-btn { cursor:pointer; }
</style>`;
}

function drawMainNode(id, pos, r, col, filterId, label, valId1, valId2, app) {
  const gl = app.glowIntensity;
  return `
<g class="efc-node" id="efc-nd-${id}" data-entity="">
  <circle cx="${pos.x}" cy="${pos.y}" r="${r + 16}"
    fill="${col.glow}" opacity="${gl}" class="efc-gr" filter="url(#${filterId})"/>
  <circle cx="${pos.x}" cy="${pos.y}" r="${r}"
    fill="${col.fill}" stroke="${col.stroke}" stroke-width="2.5" filter="url(#${filterId})"/>
  <text x="${pos.x}" y="${pos.y - Math.round(r*0.28) - 2}" text-anchor="middle" dominant-baseline="middle"
    font-size="${app.fontNodeLabel}" font-weight="600" font-family="sans-serif" fill="${col.stroke}">${label}</text>
  <text id="${valId1}" x="${pos.x}" y="${pos.y + Math.round(r*0.12)}" text-anchor="middle" dominant-baseline="middle"
    font-size="${app.fontNodeValue}" font-weight="700" font-family="sans-serif" fill="#ffffff">—</text>
  <text id="${valId2}" x="${pos.x}" y="${pos.y + Math.round(r*0.50)}" text-anchor="middle" dominant-baseline="middle"
    font-size="${app.fontNodeSecondary}" font-family="sans-serif" fill="#ffffff" opacity="0.75"></text>
</g>`;
}

function drawStringBox(slotIdx, name, valId, app, col) {
  const x  = STR_SLOT_X[slotIdx];
  const cx = x + STR_BOX_W / 2;
  return `
<g class="efc-node" id="efc-str-${slotIdx}">
  <rect x="${x}" y="${STR_Y}" width="${STR_BOX_W}" height="${STR_BOX_H}" rx="7"
    fill="${col.fill}" stroke="${col.stroke}" stroke-width="1.5"/>
  <text x="${cx}" y="${STR_Y + Math.round(STR_BOX_H * 0.35)}" text-anchor="middle" dominant-baseline="middle"
    font-size="${app.fontSecLabel}" font-weight="600" font-family="sans-serif" fill="${col.stroke}">◈ ${name}</text>
  <text id="${valId}" x="${cx}" y="${STR_Y + Math.round(STR_BOX_H * 0.72)}" text-anchor="middle" dominant-baseline="middle"
    font-size="${app.fontSecValue}" font-weight="700" font-family="sans-serif" fill="#ffffff">—</text>
</g>`;
}

function drawStringLine(slotIdx, r, col, app) {
  const cx = STR_SLOT_X[slotIdx] + STR_BOX_W / 2;
  const sy = STR_Y + STR_BOX_H;
  const tx = POS.solar.x;
  const ty = POS.solar.y - r;
  return `<path id="efc-strline-${slotIdx}" d="M ${cx} ${sy} C ${cx} ${(sy+ty)/2+10} ${tx} ${(sy+ty)/2-10} ${tx} ${ty}"
    fill="none" stroke="${col.stroke}" stroke-width="${app.lineWidth * 0.5}"
    stroke-dasharray="5 3" opacity="0.45"/>`;
}

function drawLoadBox(slotIdx, name, color, valId, active, app, defaultCol) {
  const x      = LOAD_SLOT_X[slotIdx];
  const cx     = x + LOAD_BOX_W / 2;
  const stroke = color || defaultCol.stroke;
  const fill   = defaultCol.fill;
  const op     = active ? '1' : '0.25';
  const cls    = active ? 'class="efc-node"' : '';
  return `
<g id="efc-load-${slotIdx}" ${cls} style="opacity:${op}">
  <rect x="${x}" y="${LOAD_Y}" width="${LOAD_BOX_W}" height="${LOAD_BOX_H}" rx="10"
    fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>
  <text x="${cx}" y="${LOAD_Y + Math.round(LOAD_BOX_H * 0.35)}" text-anchor="middle" dominant-baseline="middle"
    font-size="${app.fontSecLabel}" font-weight="600" font-family="sans-serif" fill="${stroke}">${name}</text>
  <text id="${valId}" x="${cx}" y="${LOAD_Y + Math.round(LOAD_BOX_H * 0.72)}" text-anchor="middle" dominant-baseline="middle"
    font-size="${app.fontSecValue}" font-weight="700" font-family="sans-serif" fill="#ffffff">—</text>
</g>`;
}

function drawLoadLine(slotIdx, color, active, r, app) {
  const cx = LOAD_SLOT_X[slotIdx] + LOAD_BOX_W / 2;
  const hx = POS.home.x;
  const hy = POS.home.y + r;
  const my = (hy + LOAD_Y) / 2 - 10;
  const op = active ? 0.5 : app.lineOpacityInactive;
  return `<path id="efc-loadline-${slotIdx}" d="M ${hx} ${hy} C ${hx} ${my+20} ${cx} ${my} ${cx} ${LOAD_Y}"
    fill="none" stroke="${color}" stroke-width="${app.lineWidth * 0.55}"
    stroke-dasharray="5 3" opacity="${op}"/>`;
}

function drawConnector(path, color, app) {
  const lw = app.lineWidth;
  return `
<g>
  <path d="${path}" fill="none" stroke="${color}" stroke-width="${lw * 8}" opacity="0.06" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="${color}" stroke-width="${lw * 4}" opacity="0.18" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="#0e0e14" stroke-width="${lw * 2.5}" opacity="1" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="${color}" stroke-width="${lw * 0.5}" opacity="0.50" stroke-linecap="round"/>
</g>`;
}

function makeDots(path, color, watt, app) {
  if (!watt || Math.abs(watt) < app.flowThreshold) return '';
  const dur = flowDur(watt, app);
  const d2  = (parseFloat(dur) / 3).toFixed(2);
  const d3  = (parseFloat(dur) * 2 / 3).toFixed(2);
  const dot = (delay) =>
    `<circle class="efc-dot" r="${app.dotSize}" fill="${color}" filter="url(#efc-dot-glow)"
      style="offset-path:path('${path}');animation-duration:${dur}s;animation-delay:-${delay}s"/>`;
  return dot('0') + dot(d2) + dot(d3);
}

// =============================================================================
// EnergyFlowCard
// =============================================================================

class EnergyFlowCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._cfg        = {};
    this._hass       = null;
    this._mode       = 'realtime';
    this._ready      = false;
    this._timer      = null;
    this._lastDotSig = null;
    this._app        = resolveAppearance({});
    this._cols       = resolveColors({});
    this._vis        = resolveDisplay({});
  }

  setConfig(cfg) {
    const clean = JSON.parse(JSON.stringify(cfg || {}));
    if (clean.solar?.strings) {
      clean.solar.strings = clean.solar.strings.filter(s => s?.entity_power);
    }
    if (clean.home?.loads) {
      clean.home.loads = clean.home.loads.filter(l => l?.entity_power);
    }
    this._cfg   = clean;
    this._mode  = clean.view_mode || 'realtime';
    this._app   = resolveAppearance(cfg);
    this._cols  = resolveColors(cfg);
    this._vis   = resolveDisplay(cfg);
    this._ready = false;
    this._lastDotSig = null;
    this._build();
    this._ready = true;
    if (this._hass) this._update();
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (this._hass && this._ready && this._mode === 'realtime') this._update();
    }, (cfg.refresh_interval || 5) * 1000);
  }

  set hass(h) {
    this._hass = h;
    if (this._ready) this._update();
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  _build() {
    const cfg  = this._cfg;
    const app  = this._app;
    const cols = this._cols;
    const vis  = this._vis;
    const r    = app.nodeRadius;

    const strings = (cfg.solar?.strings || []).slice(0, 4);
    const loads   = (cfg.home?.loads   || []).slice(0, 5);

    const strSlotMap = Array(4).fill(null);
    strings.forEach((str, i) => { strSlotMap[STR_SLOTS[i]] = str; });

    const loadSlotMap = Array(5).fill(null);
    loads.forEach((load, i) => { loadSlotMap[LOAD_SLOTS[i]] = load; });

    const pathSolarBattery = `M ${POS.solar.x + r} ${POS.solar.y - 12} C ${POS.solar.x + 160} ${POS.solar.y - 40} ${POS.battery.x - 160} ${POS.battery.y - 40} ${POS.battery.x - r} ${POS.battery.y - 12}`;
    const pathSolarGrid    = `M ${POS.solar.x - 12} ${POS.solar.y + r} C ${POS.solar.x - 40} ${POS.solar.y + 100} ${POS.grid.x - 40} ${POS.grid.y - 100} ${POS.grid.x - 12} ${POS.grid.y - r}`;
    const pathSolarHome    = `M ${POS.solar.x + r - 22} ${POS.solar.y + r - 22} C ${POS.solar.x + 150} ${POS.solar.y + 90} ${POS.home.x - 150} ${POS.home.y - 90} ${POS.home.x - r + 22} ${POS.home.y - r + 22}`;
    const pathBatteryHome  = `M ${POS.battery.x + 12} ${POS.battery.y + r} C ${POS.battery.x + 40} ${POS.battery.y + 100} ${POS.home.x + 40} ${POS.home.y - 100} ${POS.home.x + 12} ${POS.home.y - r}`;
    const pathGridHome     = `M ${POS.grid.x + r} ${POS.grid.y + 12} C ${POS.grid.x + 160} ${POS.grid.y + 40} ${POS.home.x - 160} ${POS.home.y + 40} ${POS.home.x - r} ${POS.home.y + 12}`;

    this._paths = { pathSolarHome, pathSolarBattery, pathSolarGrid, pathBatteryHome, pathGridHome };

    const btnY     = 715;
    const btnLabel = this._mode === 'realtime' ? '⚡ Realtime' : '📊 Storico';
    const btnFill  = this._mode === 'realtime' ? '#1565C0' : '#2a2a2a';

    this.shadowRoot.innerHTML = `
${buildCSS(app)}
<ha-card>
  <svg class="efc-svg" viewBox="0 0 ${VB.w} ${VB.h}" xmlns="http://www.w3.org/2000/svg">
    ${buildDefs(app, cols)}

    ${vis.showStrings ? strSlotMap.map((str, si) =>
      str ? drawStringLine(si, r, cols.solar, app) : ''
    ).join('') : ''}
    ${vis.showStrings ? strSlotMap.map((str, si) =>
      str ? drawStringBox(si, str.name || `Str ${si+1}`, `efc-sv-str${si}`, app, {
        stroke: cols.solar.stroke, fill: '#1a1200'
      }) : ''
    ).join('') : ''}

    ${drawConnector(pathSolarBattery, cols.solar.stroke,   app)}
    ${drawConnector(pathSolarHome,    cols.solar.stroke,   app)}
    ${vis.showGrid    ? drawConnector(pathSolarGrid,   cols.solar.stroke,   app) : ''}
    ${vis.showBattery ? drawConnector(pathBatteryHome, cols.battery.stroke, app) : ''}
    ${vis.showGrid    ? drawConnector(pathGridHome,    cols.grid.stroke,    app) : ''}

    ${vis.showLoads ? loadSlotMap.map((load, li) =>
      load ? drawLoadLine(li, load.color || '#26C6DA', true, r, app) : ''
    ).join('') : ''}

    <g id="efc-dots"></g>

    ${drawMainNode('solar', POS.solar, r, cols.solar, 'efc-gs', '☀ Solare', 'efc-v-solar1', 'efc-v-solar2', app)}

    ${vis.showBattery ? drawMainNode('battery', POS.battery, r, cols.battery, 'efc-gb', '🔋 Batteria', 'efc-v-battery1', 'efc-v-battery2', app) : ''}

    ${vis.showGrid ? drawMainNode('grid', POS.grid, r, cols.grid, 'efc-gg', '⚡ Rete', 'efc-v-grid1', 'efc-v-grid2', app) : ''}

    ${drawMainNode('home', POS.home, r, cols.home, 'efc-gh', '🏠 Casa', 'efc-v-home1', 'efc-v-home2', app)}

    ${vis.showLoads ? loadSlotMap.map((load, li) =>
      load ? drawLoadBox(li, load.name || `CR${li+1}`, load.color, `efc-v-load${li}`, true, app, { stroke: '#26C6DA', fill: '#001a1a' }) : ''
    ).join('') : ''}

    ${vis.showHistoryBtn ? `
    <g class="efc-mode-btn" onclick="this.getRootNode().host._toggleMode()"
      transform="translate(${(VB.w - 180) / 2}, ${btnY})">
      <rect x="0" y="0" width="180" height="44" rx="22" fill="${btnFill}" opacity="0.95"/>
      <text id="efc-btn-label" x="90" y="22" text-anchor="middle" dominant-baseline="middle"
        font-size="18" font-weight="600" font-family="sans-serif" fill="#fff">${btnLabel}</text>
    </g>` : ''}

  </svg>
</ha-card>`;

    this.shadowRoot.querySelectorAll('.efc-node').forEach(el => {
      el.addEventListener('click', () => {
        const entityId = el.dataset?.entity;
        if (entityId) this.dispatchEvent(new CustomEvent('hass-more-info', {
          composed: true, bubbles: true, detail: { entityId }
        }));
      });
    });
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  _update() {
    const hass = this._hass;
    const cfg  = this._cfg;
    const app  = this._app;
    const vis  = this._vis;
    const mode = this._mode;
    if (!hass || !cfg) return;

    const gW  = (id, unit) => getW(hass, id, unit);
    const gR  = (id)       => getRaw(hass, id);
    const thr = app.flowThreshold;

    // SOLARE
    const solarW = mode === 'realtime'
      ? gW(cfg.solar?.entity_power, cfg.solar?.unit)
      : gR(cfg.solar?.entity_energy);
    const solarActive = isActiveValue(solarW, thr, mode);
    this._t('efc-v-solar1', mode === 'realtime' ? fmtW(solarW) : fmtE(solarW), app.fontNodeValue);
    this._setOpacity('efc-nd-solar', solarActive, app.lineOpacityInactive);

    // Stringhe
    if (vis.showStrings) {
      (cfg.solar?.strings || []).slice(0, 4).forEach((str, i) => {
        const si = STR_SLOTS[i];
        const v  = mode === 'realtime'
          ? gW(str.entity_power, str.unit)
          : gR(str.entity_energy);
        const on = isActiveValue(v, thr, mode);
        this._t(`efc-sv-str${si}`, mode === 'realtime' ? fmtW(v) : fmtE(v));
        const box  = this.shadowRoot.getElementById(`efc-str-${si}`);
        if (box) box.style.opacity = on ? '1' : '0.35';
        const line = this.shadowRoot.getElementById(`efc-strline-${si}`);
        if (line) line.classList.toggle('efc-da', on);
      });
    }

    // RETE
    let gridIn = 0, gridOut = 0;
    if (vis.showGrid) {
      gridIn  = mode === 'realtime' ? gW(cfg.grid?.entity_import)  : gR(cfg.grid?.entity_import_energy);
      gridOut = mode === 'realtime' ? gW(cfg.grid?.entity_export)  : gR(cfg.grid?.entity_export_energy);

      const valIn  = mode === 'realtime' ? fmtW(gridIn)  : fmtE(gridIn);
      const valOut = mode === 'realtime' ? fmtW(gridOut) : fmtE(gridOut);

      this._t('efc-v-grid1', `<tspan font-size="0.65em">→ </tspan>${valIn}`, app.fontNodeValue);
      this._t('efc-v-grid2', `<tspan font-size="0.65em">← </tspan>${valOut}`, app.fontNodeSecondary);

      const gridActive = isActiveValue(gridIn, thr, mode) || isActiveValue(gridOut, thr, mode);
      this._setOpacity('efc-nd-grid', gridActive, app.lineOpacityInactive);
    }

    // BATTERIA
    let batW = 0;
    if (vis.showBattery) {
      const batC = gW(cfg.battery?.entity_power);
      const batD = gW(cfg.battery?.entity_discharge);
      batW = batC || 0;
      if (batD !== null && batD !== undefined) batW = (batC || 0) - (batD || 0);

      if (mode === 'realtime') {
        const batSoc = gR(cfg.battery?.entity_soc);
        const socStr = batSoc !== null ? `${Math.round(batSoc)} %` : '—';
        this._t('efc-v-battery1', socStr, app.fontNodeValue);

        let batSecStr = fmtW(0);
        if (batW > thr) {
          batSecStr = `<tspan font-size="1.0em">↑ </tspan>${fmtW(batW)}`;
        } else if (batW < -thr) {
          batSecStr = `<tspan font-size="1.0em">↓ </tspan>${fmtW(Math.abs(batW))}`;
        }
        this._t('efc-v-battery2', batSecStr, app.fontNodeSecondary + 4);
      } else {
        const batEIn  = gR(cfg.battery?.entity_energy_in);
        const batEOut = gR(cfg.battery?.entity_energy_out);
        this._t('efc-v-battery1', fmtE(batEIn), app.fontNodeValue);
        this._t('efc-v-battery2', fmtE(batEOut), app.fontNodeSecondary);
      }

      const batActive = isActiveValue(batW, thr, mode);
      this._setOpacity('efc-nd-battery', batActive, app.lineOpacityInactive);
    }

    // CASA
    const homeW = mode === 'realtime' ? gW(cfg.home?.entity_power) : gR(cfg.home?.entity_energy);
    const homeActive = isActiveValue(homeW, thr, mode);
    this._t('efc-v-home1', mode === 'realtime' ? fmtW(homeW) : fmtE(homeW), app.fontNodeValue);
    this._setOpacity('efc-nd-home', homeActive, app.lineOpacityInactive);

    // Carichi
    if (vis.showLoads) {
      (cfg.home?.loads || []).slice(0, 5).forEach((load, i) => {
        const li = LOAD_SLOTS[i];
        const v  = mode === 'realtime' ? gW(load.entity_power) : gR(load.entity_energy);
        const on = isActiveValue(v, thr, mode);
        this._t(`efc-v-load${li}`, mode === 'realtime' ? fmtW(v) : fmtE(v));
        const box  = this.shadowRoot.getElementById(`efc-load-${li}`);
        if (box) box.style.opacity = on ? '1' : '0.3';
        const line = this.shadowRoot.getElementById(`efc-loadline-${li}`);
        if (line) {
          line.style.opacity = on ? '0.5' : String(app.lineOpacityInactive);
          line.classList.toggle('efc-da', on);
        }
      });
    }

    this._updateDots({ solarW, gridIn, gridOut, batW });
  }

  _t(id, val, baseSize = null) {
    const el = this.shadowRoot.getElementById(id);
    if (!el || val === undefined) return;

    // innerHTML per supportare tspan (frecce direzionali)
    el.innerHTML = val;

    if (baseSize) {
      const plainText = String(val).replace(/<[^>]*>?/gm, '').trim();
      const len = plainText.length;
      let scale = 1.0;
      if (len >= 10) scale = 0.70;
      else if (len >= 9) scale = 0.80;
      else if (len >= 8) scale = 0.90;
      el.setAttribute('font-size', Math.round(baseSize * scale));
    }
  }

  _setOpacity(id, active, inactiveOp) {
    const el = this.shadowRoot.getElementById(id);
    if (el) el.style.opacity = active ? '1' : String(inactiveOp);
  }

  // ---------------------------------------------------------------------------
  // DOTS
  // ---------------------------------------------------------------------------

  _updateDots({ solarW, gridIn, gridOut, batW }) {
    const g = this.shadowRoot.getElementById('efc-dots');
    if (!g) return;
    const app  = this._app;
    const vis  = this._vis;
    const thr  = app.flowThreshold;
    const p    = this._paths;
    const cols = this._cols;

    const sig = [
      isActive(solarW, thr)  ? Math.round(solarW/200)  : 0,
      isActive(gridIn, thr)  ? Math.round(gridIn/200)  : 0,
      isActive(gridOut, thr) ? Math.round(gridOut/200) : 0,
      batW > thr             ? Math.round(batW/200)    : 0,
      batW < -thr            ? Math.round(-batW/200)   : 0,
    ].join(',');

    if (sig === this._lastDotSig) return;
    this._lastDotSig = sig;

    let html = '';

    if (isActive(solarW, thr))
      html += makeDots(p.pathSolarHome, cols.solar.stroke, solarW, app);

    if (isActive(solarW, thr) && batW > thr && vis.showBattery)
      html += makeDots(p.pathSolarBattery, cols.solar.stroke, batW, app);

    if (isActive(solarW, thr) && gridOut > thr * 2 && vis.showGrid)
      html += makeDots(p.pathSolarGrid, cols.solar.stroke, gridOut, app);

    if (isActive(gridIn, thr) && vis.showGrid)
      html += makeDots(p.pathGridHome, cols.grid.stroke, gridIn, app);

    if (batW < -thr && vis.showBattery)
      html += makeDots(p.pathBatteryHome, cols.battery.stroke, -batW, app);

    g.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // TOGGLE MODE
  // ---------------------------------------------------------------------------

  _toggleMode() {
    this._setMode(this._mode === 'realtime' ? 'history' : 'realtime');
  }

  _setMode(mode) {
    this._mode = mode;
    const btn = this.shadowRoot.getElementById('efc-btn-label');
    if (btn) {
      btn.textContent = mode === 'realtime' ? '⚡ Realtime' : '📊 Storico';
      btn.parentElement.querySelector('rect')?.setAttribute('fill', mode === 'realtime' ? '#1565C0' : '#2a2a2a');
    }
    this._lastDotSig = null;
    if (this._hass) this._update();
  }

  getCardSize()    { return 8; }
  getGridOptions() { return { columns: 12, rows: 8, min_rows: 6 }; }

  static getStubConfig() {
    return {
      view_mode: 'realtime',
      solar   : { entity_power: '', unit: 'kW', entity_energy: '', strings: [] },
      grid    : { entity_import: '', entity_export: '', entity_import_energy: '', entity_export_energy: '' },
      battery : { entity_power: '', entity_discharge: '', entity_soc: '', entity_energy_in: '', entity_energy_out: '' },
      home    : { entity_power: '', entity_energy: '', loads: [] },
    };
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }
}

// =============================================================================
// Editor — LitElement
// =============================================================================

const LitElement = Object.getPrototypeOf(customElements.get('ha-panel-lovelace'));
const html = LitElement.prototype.html;
const css  = LitElement.prototype.css;

class EnergyFlowCardEditor extends LitElement {

  static get properties() {
    return { hass: {}, _cfg: {}, _open: {}, _subTab: {} };
  }

  constructor() {
    super();
    this._cfg    = {};
    // Tutte le sezioni chiuse di default all'apertura dell'editor
    this._open   = {
      solar: false, grid: false, battery: false, home: false,
      appearance: false, display: false,
    };
    // Sotto-tab attiva per ogni sezione (realtime | history)
    this._subTab = {
      solar: 'realtime', grid: 'realtime', battery: 'realtime', home: 'realtime',
    };
  }

  setConfig(c) { this._cfg = JSON.parse(JSON.stringify(c || {})); }

  _fire() {
    this.dispatchEvent(new CustomEvent('config-changed',
      { detail: { config: this._cfg }, bubbles: true, composed: true }));
  }

  _set(path, val) {
    const parts = path.split('.');
    const cfg   = JSON.parse(JSON.stringify(this._cfg));
    let o = cfg;
    parts.forEach((k, i) => {
      if (i === parts.length - 1) {
        if (typeof val === 'boolean') o[k] = val;
        else if (val !== '' && !isNaN(val) && val !== null && val !== 'auto') o[k] = Number(val);
        else o[k] = val;
      } else {
        const nextKey   = parts[i + 1];
        const nextIsIdx = !isNaN(nextKey);
        if (o[k] === undefined || o[k] === null) {
          o[k] = nextIsIdx ? [] : {};
        }
        if (nextIsIdx && Array.isArray(o[k])) {
          const idx = parseInt(nextKey);
          while (o[k].length <= idx) o[k].push({});
        }
        o = o[k];
      }
    });
    this._cfg = cfg;
    this._fire();
  }

  _get(path, def = '') {
    const v = path.split('.').reduce((o, k) => {
      if (o === undefined || o === null) return undefined;
      return o[k];
    }, this._cfg);
    return v !== undefined && v !== null ? v : def;
  }

  _toggleSection(id) {
    this._open = { ...this._open, [id]: !this._open[id] };
    this.requestUpdate();
  }

  _setSubTab(section, tab) {
    this._subTab = { ...this._subTab, [section]: tab };
    this.requestUpdate();
  }

  // ── Entity field tramite ha-selector (antiproiettile e nativo) ─────────────
  _entityField(label, path) {
    const val = this._get(path, '');
    return html`
      <div style="margin-bottom:8px;">
        <ha-selector
          .hass=${this.hass}
          .selector=${ { entity: {} } }
          .label=${label}
          .value=${val}
          @value-changed=${e => {
            if (e.detail && e.detail.value !== undefined) {
              this._set(path, e.detail.value);
            }
          }}
        ></ha-selector>
      </div>`;
  }

  _slider(label, path, min, max, step, def, unit = '') {
    const val = parseFloat(this._get(path, def));
    return html`
      <div style="margin-bottom:8px;">
        <div class="slider-row">
          <span class="slider-lbl">${label}</span>
          <div class="slider-wrap">
            <input type="range" min="${min}" max="${max}" step="${step}" .value=${val}
              @input=${e => this._set(path, parseFloat(e.target.value))}/>
            <span class="slider-val">${val}${unit}</span>
          </div>
        </div>
      </div>`;
  }

  _toggle(label, path, def = true) {
    const val     = this._get(path);
    const checked = val === '' ? def : !!val;
    return html`
      <div class="glow-row" style="margin-bottom:8px;">
        <span class="glow-lbl">${label}</span>
        <ha-switch .checked=${checked}
          @change=${e => this._set(path, e.target.checked)}></ha-switch>
      </div>`;
  }

  _color(label, path, def = '#000000') {
    const val = this._get(path) || def;
    return html`
      <div class="color-row">
        <span class="color-lbl">${label}</span>
        <div class="color-wrap">
          <input type="color" .value=${val}
            @input=${e => this._set(path, e.target.value)}/>
          <input type="text" .value=${val} placeholder="${def}"
            @change=${e => this._set(path, e.target.value)}/>
        </div>
      </div>`;
  }

  _num(label, path, ph = '') {
    const val = this._get(path, '');
    return html`
      <div style="margin-bottom:8px;">
        <ha-textfield label="${label}" .value=${val} placeholder="${ph}" type="number"
          @change=${e => this._set(path, e.target.value)}></ha-textfield>
      </div>`;
  }

  _txt(label, path, ph = '') {
    const val = this._get(path, '');
    return html`
      <div style="margin-bottom:8px;">
        <ha-textfield label="${label}" .value=${val} placeholder="${ph}"
          @change=${e => this._set(path, e.target.value)}></ha-textfield>
      </div>`;
  }

  // ── Sotto-tab realtime/storico ─────────────────────────────────────────────
  _subTabs(section, rtContent, histContent) {
    const active = this._subTab[section] || 'realtime';
    return html`
      <div class="subtab-bar">
        <div class="subtab ${active === 'realtime' ? 'subtab-active' : ''}"
          @click=${() => this._setSubTab(section, 'realtime')}>⚡ Realtime</div>
        <div class="subtab ${active === 'history' ? 'subtab-active' : ''}"
          @click=${() => this._setSubTab(section, 'history')}>📊 Storico</div>
      </div>
      <div class="subtab-body">
        ${active === 'realtime' ? rtContent : histContent}
      </div>`;
  }

  // ── Section collassabile ───────────────────────────────────────────────────
  _section(id, icon, title, content) {
    const open = this._open[id];
    return html`
      <div class="section-wrap">
        <div class="section-header" @click=${() => this._toggleSection(id)}>
          <span class="section-icon">${icon}</span>
          <span class="section-title">${title}</span>
          <span class="section-chevron">${open ? '▲' : '▼'}</span>
        </div>
        ${open ? html`<div class="section-body">${content}</div>` : ''}
      </div>`;
  }

  render() {
    if (!this._cfg) return html``;
    return html`
      <div class="editor">

        ${this._section('solar', '☀️', 'Solare', html`
          ${this._subTabs('solar',
            html`
              ${this._entityField('Potenza', 'solar.entity_power')}
              ${this._txt('Unità (kW / W)', 'solar.unit', 'kW')}
              <div class="sec-sub">Stringa 1</div>
              ${this._entityField('Potenza Str 1', 'solar.strings.0.entity_power')}
              ${this._txt('Nome', 'solar.strings.0.name', 'Str 1')}
              ${this._txt('Unità', 'solar.strings.0.unit', 'kW')}
              <div class="sec-sub">Stringa 2</div>
              ${this._entityField('Potenza Str 2', 'solar.strings.1.entity_power')}
              ${this._txt('Nome', 'solar.strings.1.name', 'Str 2')}
              ${this._txt('Unità', 'solar.strings.1.unit', 'kW')}
              <div class="sec-sub">Stringa 3</div>
              ${this._entityField('Potenza Str 3', 'solar.strings.2.entity_power')}
              ${this._txt('Nome', 'solar.strings.2.name', 'Str 3')}
              ${this._txt('Unità', 'solar.strings.2.unit', 'kW')}
              <div class="sec-sub">Stringa 4</div>
              ${this._entityField('Potenza Str 4', 'solar.strings.3.entity_power')}
              ${this._txt('Nome', 'solar.strings.3.name', 'Str 4')}
              ${this._txt('Unità', 'solar.strings.3.unit', 'kW')}
            `,
            html`
              ${this._entityField('Energia prodotta', 'solar.entity_energy')}
              <div class="sec-sub">Stringa 1</div>
              ${this._entityField('Energia Str 1', 'solar.strings.0.entity_energy')}
              <div class="sec-sub">Stringa 2</div>
              ${this._entityField('Energia Str 2', 'solar.strings.1.entity_energy')}
              <div class="sec-sub">Stringa 3</div>
              ${this._entityField('Energia Str 3', 'solar.strings.2.entity_energy')}
              <div class="sec-sub">Stringa 4</div>
              ${this._entityField('Energia Str 4', 'solar.strings.3.entity_energy')}
            `
          )}
        `)}

        ${this._section('grid', '⚡', 'Rete', html`
          ${this._subTabs('grid',
            html`
              ${this._entityField('Prelievo (W)', 'grid.entity_import')}
              ${this._entityField('Immissione (W)', 'grid.entity_export')}
            `,
            html`
              ${this._entityField('Energia prelievo', 'grid.entity_import_energy')}
              ${this._entityField('Energia immissione', 'grid.entity_export_energy')}
            `
          )}
        `)}

        ${this._section('battery', '🔋', 'Batteria', html`
          ${this._subTabs('battery',
            html`
              ${this._entityField('Carica (W)', 'battery.entity_power')}
              ${this._entityField('Scarica (W)', 'battery.entity_discharge')}
              ${this._entityField('SOC (%)', 'battery.entity_soc')}
            `,
            html`
              ${this._entityField('Energia carica', 'battery.entity_energy_in')}
              ${this._entityField('Energia scarica', 'battery.entity_energy_out')}
            `
          )}
        `)}

        ${this._section('home', '🏠', 'Casa', html`
          ${this._subTabs('home',
            html`
              ${this._entityField('Potenza totale (W)', 'home.entity_power')}
              <div class="sec-sub">Carico 1</div>
              ${this._entityField('Potenza CR1', 'home.loads.0.entity_power')}
              ${this._txt('Nome CR1', 'home.loads.0.name', 'Carico 1')}
              ${this._color('Colore CR1', 'home.loads.0.color', '#26C6DA')}
              <div class="sec-sub">Carico 2</div>
              ${this._entityField('Potenza CR2', 'home.loads.1.entity_power')}
              ${this._txt('Nome CR2', 'home.loads.1.name', 'Carico 2')}
              ${this._color('Colore CR2', 'home.loads.1.color', '#26C6DA')}
              <div class="sec-sub">Carico 3</div>
              ${this._entityField('Potenza CR3', 'home.loads.2.entity_power')}
              ${this._txt('Nome CR3', 'home.loads.2.name', 'Carico 3')}
              ${this._color('Colore CR3', 'home.loads.2.color', '#26C6DA')}
              <div class="sec-sub">Carico 4</div>
              ${this._entityField('Potenza CR4', 'home.loads.3.entity_power')}
              ${this._txt('Nome CR4', 'home.loads.3.name', 'Carico 4')}
              ${this._color('Colore CR4', 'home.loads.3.color', '#26C6DA')}
              <div class="sec-sub">Carico 5</div>
              ${this._entityField('Potenza CR5', 'home.loads.4.entity_power')}
              ${this._txt('Nome CR5', 'home.loads.4.name', 'Carico 5')}
              ${this._color('Colore CR5', 'home.loads.4.color', '#26C6DA')}
            `,
            html`
              ${this._entityField('Energia totale', 'home.entity_energy')}
              <div class="sec-sub">Carico 1</div>
              ${this._entityField('Energia CR1', 'home.loads.0.entity_energy')}
              <div class="sec-sub">Carico 2</div>
              ${this._entityField('Energia CR2', 'home.loads.1.entity_energy')}
              <div class="sec-sub">Carico 3</div>
              ${this._entityField('Energia CR3', 'home.loads.2.entity_energy')}
              <div class="sec-sub">Carico 4</div>
              ${this._entityField('Energia CR4', 'home.loads.3.entity_energy')}
              <div class="sec-sub">Carico 5</div>
              ${this._entityField('Energia CR5', 'home.loads.4.entity_energy')}
            `
          )}
        `)}

        ${this._section('appearance', '🎨', 'Aspetto', html`
          <div class="sec-sub">Dimensioni nodi</div>
          ${this._slider('Raggio nodi',    'appearance.node_radius', 40, 120, 1, 77, 'px')}
          ${this._slider('Pallini flusso', 'appearance.dot_size',    2,  12,  1, 6,  'px')}

          <div class="sec-sub">Animazione</div>
          ${this._txt('Velocità pallini (auto oppure secondi)', 'appearance.dot_speed', 'auto')}

          <div class="sec-sub">Glow</div>
          ${this._slider('Intensità',     'appearance.glow_intensity', 0,   1, 0.01, 0.08)}
          ${this._slider('Velocità pulse','appearance.glow_speed',     0.5, 8, 0.1,  2.8, 's')}

          <div class="sec-sub">Linee</div>
          ${this._slider('Spessore',        'appearance.line_width',            0.5, 6,   0.5,  2.5, 'px')}
          ${this._slider('Opacità inattivo','appearance.line_opacity_inactive', 0,   1,   0.05, 0.15)}

          <div class="sec-sub">Soglia flusso</div>
          ${this._slider('Watt minimi', 'appearance.flow_threshold', 1, 100, 1, 10, 'W')}

          <div class="sec-sub">Font — nodi principali</div>
          <div class="row2">
            ${this._num('Titolo (px)',  'appearance.font_node_label',    '19')}
            ${this._num('Valore (px)',  'appearance.font_node_value',    '31')}
          </div>
          ${this._num('Secondario (px)', 'appearance.font_node_secondary', '15')}

          <div class="sec-sub">Font — stringhe e carichi</div>
          <div class="row2">
            ${this._num('Titolo (px)', 'appearance.font_secondary_label', '14')}
            ${this._num('Valore (px)', 'appearance.font_secondary_value', '19')}
          </div>

          <div class="sec-sub">Colori</div>
          <div class="row2">
            ${this._color('☀ Solare bordo',    'colors.solar.stroke',   '#F9A825')}
            ${this._color('☀ Solare sfondo',   'colors.solar.fill',     '#1e1400')}
          </div>
          <div class="row2">
            ${this._color('🔋 Batteria bordo', 'colors.battery.stroke', '#E91E63')}
            ${this._color('🔋 Batteria sfondo','colors.battery.fill',   '#1a0020')}
          </div>
          <div class="row2">
            ${this._color('⚡ Rete bordo',     'colors.grid.stroke',    '#42A5F5')}
            ${this._color('⚡ Rete sfondo',    'colors.grid.fill',      '#001533')}
          </div>
          <div class="row2">
            ${this._color('🏠 Casa bordo',     'colors.home.stroke',    '#EF5350')}
            ${this._color('🏠 Casa sfondo',    'colors.home.fill',      '#1a0500')}
          </div>
        `)}

        ${this._section('display', '👁', 'Visibilità', html`
          ${this._toggle('Mostra nodo Rete',        'display.show_grid',           true)}
          ${this._toggle('Mostra nodo Batteria',    'display.show_battery',        true)}
          ${this._toggle('Mostra stringhe solari',  'display.show_strings',        true)}
          ${this._toggle('Mostra carichi casa',     'display.show_loads',          true)}
          ${this._toggle('Mostra bottone Storico',  'display.show_history_button', true)}
        `)}

      </div>`;
  }

  static get styles() {
    return css`
      :host { display:block; padding:4px 0; }
      .editor { display:flex; flex-direction:column; gap:8px; padding:4px 16px 16px; }
      .section-wrap   { border:1px solid var(--divider-color); border-radius:10px; overflow:hidden; margin-bottom: 4px; }
      .section-header { display:flex; align-items:center; gap:8px; padding:10px 12px; cursor:pointer;
                        background:var(--secondary-background-color); user-select:none; }
      .section-icon   { font-size:16px; }
      .section-title  { flex:1; font-size:13px; font-weight:600; color:var(--primary-text-color); }
      .section-chevron{ font-size:11px; color:var(--secondary-text-color); }
      .section-body   { padding:12px; display:flex; flex-direction:column; gap:4px;
                        border-top:1px solid var(--divider-color); }
      .sec-sub { font-size:11px; font-weight:600; color:var(--secondary-text-color);
                 text-transform:uppercase; letter-spacing:.06em; margin-top:6px; margin-bottom:4px; }
      /* Sotto-tab */
      .subtab-bar { display:flex; gap:0; border:1px solid var(--divider-color); border-radius:8px;
                    overflow:hidden; margin-bottom:10px; }
      .subtab { flex:1; padding:8px; text-align:center; font-size:12px; font-weight:600;
                cursor:pointer; color:var(--secondary-text-color);
                background:var(--card-background-color); transition:all .15s; }
      .subtab:first-child { border-right:1px solid var(--divider-color); }
      .subtab-active { color:var(--primary-text-color); background:var(--secondary-background-color); }
      .subtab-body { display:flex; flex-direction:column; gap:4px; }
      
      ha-textfield { width:100%; display:block; }
      ha-selector { width:100%; display:block; }

      /* Slider */
      .slider-row  { display:flex; align-items:center; gap:8px; }
      .slider-lbl  { font-size:12px; color:var(--primary-text-color); flex:0 0 140px; }
      .slider-wrap { display:flex; align-items:center; gap:6px; flex:1; }
      .slider-wrap input[type=range] { flex:1; accent-color:var(--primary-color); }
      .slider-val  { font-size:12px; color:var(--secondary-text-color); min-width:36px; text-align:right; }
      /* Toggle */
      .glow-row { display:flex; align-items:center; padding:6px 0; }
      .glow-lbl { font-size:13px; color:var(--primary-text-color); flex:1; }
      /* Color */
      .color-row { display:flex; flex-direction:column; gap:4px; margin-bottom:8px; }
      .color-lbl { font-size:12px; color:var(--secondary-text-color); }
      .color-wrap { display:flex; gap:6px; align-items:center; }
      .color-wrap input[type=color] { width:36px; height:32px; padding:2px; border-radius:6px;
        border:1px solid var(--divider-color); cursor:pointer; background:none; flex-shrink:0; }
      .color-wrap input[type=text] { 
        flex:1; width:100%; box-sizing:border-box; padding:6px 8px; font-size:12px;
        border:1px solid var(--divider-color,#555); border-radius:6px;
        background:var(--card-background-color); color:var(--primary-text-color); 
      }
      /* Grid 2 col */
      .row2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    `;
  }
}

// =============================================================================
// Registrazione
// =============================================================================

customElements.define('energy-flow-card',        EnergyFlowCard);
customElements.define('energy-flow-card-editor', EnergyFlowCardEditor);
EnergyFlowCard.getConfigElement = () => document.createElement('energy-flow-card-editor');
EnergyFlowCard.getStubConfig    = EnergyFlowCard.getStubConfig;

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'energy-flow-card',
  name: 'Energy Flow Card',
  description: 'Flusso energetico — solare, rete, batteria, carichi',
  preview: true,
  documentationURL: 'https://github.com/themask1987/energy-flow-card',
});

console.info(
  `%c ENERGY-FLOW-CARD %c v${CARD_VERSION} `,
  'background:#F9A825;color:#000;font-weight:bold;padding:2px 4px;border-radius:3px 0 0 3px',
  'background:#1565C0;color:#fff;font-weight:bold;padding:2px 4px;border-radius:0 3px 3px 0',
);
