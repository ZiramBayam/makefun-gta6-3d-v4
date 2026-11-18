// DOM HUD and menus: Solar Noir instrumentation drawn over the live 3D frame.
import { BUTTON_IDS, MISSIONS } from './config.js';

const LABELS = {
  play: 'Start job', continue: 'Continue', controls: 'Controls', back: 'Back',
  resume: 'Resume', save: 'Save game', mute: 'Sound: on', restart: 'Restart',
};
const btn = (id, extra = '') => `<button id="btn-${id}" class="menu-btn ${extra}" data-action="${id}">${LABELS[id]}</button>`;

export function createHud(root) {
  root.innerHTML = `
    <div id="hud-money-panel" class="panel">
      <div class="metric-label">Cash on hand</div>
      <div id="hud-money" class="metric-value">$0</div>
      <div id="hud-bars">
        <div class="bar-row"><span class="bar-tag">Health</span><span class="bar-track"><span id="bar-health" class="bar-fill"></span></span></div>
        <div class="bar-row"><span class="bar-tag">Armor</span><span class="bar-track"><span id="bar-armor" class="bar-fill"></span></span></div>
      </div>
    </div>
    <div id="hud-status-panel" class="panel">
      <div class="metric-label">Wanted</div>
      <div id="hud-wanted"></div>
      <div id="hud-job">Free roam</div>
      <div id="hud-objective"></div>
    </div>
    <div id="hud-map-panel" class="panel">
      <canvas id="minimap" width="172" height="172"></canvas>
      <div id="map-caption"><span>Cielo Bay</span><span id="map-weather">Clear</span></div>
    </div>
    <div id="hud-ammo-panel" class="panel">
      <div class="metric-label">Sidearm</div>
      <div id="hud-ammo" class="metric-value">12 / 12</div>
      <div id="hud-speed">On foot</div>
    </div>
    <div id="objective-arrow"><span class="arrow">▲</span><span id="objective-name"></span></div>
    <div id="crosshair"></div>
    <div id="hint"></div>
    <div id="toast" class="hidden"></div>
    <div id="dialogue" class="hidden"><div class="who"></div><div class="line"></div></div>

    <div class="screen hidden" data-screen="title">
      <div class="eyebrow">An open world in late afternoon</div>
      <h1>CIELO <em>BAY</em></h1>
      <div class="rule"></div>
      <p>Sun-bleached streets, a harbour full of secrets, and four jobs that lead to one last reckoning. Explore on foot or behind the wheel.</p>
      <div class="menu">${btn('play', 'primary')}${btn('continue')}${btn('controls')}</div>
      <div class="credit">Solar Noir · original procedural city</div>
    </div>
    <div class="screen hidden" data-screen="controls">
      <h2>Controls</h2>
      <div class="controls-grid">
        <b>WASD / Arrows</b><span>Move or drive</span>
        <b>Shift</b><span>Sprint</span>
        <b>Mouse</b><span>Look around with pointer lock</span>
        <b>Left click</b><span>Fire at the crosshair</span>
        <b>Right mouse</b><span>Aim — narrower view, slower turn</span>
        <b>E</b><span>Enter or steal a car, exit again</span>
        <b>J / Space</b><span>Melee</span>
        <b>F / H</b><span>Handbrake / headlights</span>
        <b>R</b><span>Toggle haze and rain</span>
        <b>F2 / F3</b><span>Raise wanted / jump near objective</span>
        <b>P / Esc · M</b><span>Pause / mute</span>
      </div>
      <div class="menu">${btn('back', 'primary')}</div>
    </div>
    <div class="screen hidden" data-screen="paused">
      <h2>Paused</h2>
      <p>The city waits. Your progress is kept on this device.</p>
      <div class="menu">${btn('resume', 'primary')}${btn('save')}${btn('mute')}${btn('restart')}</div>
    </div>
    <div class="screen hidden" data-screen="win">
      <div class="eyebrow">The plaza is quiet again</div>
      <h1><em>SOLAR</em> NOIR</h1>
      <div class="rule"></div>
      <p id="win-summary">Every job paid. Cielo Bay belongs to nobody — least of all the people who thought they owned it.</p>
      <div class="menu">${btn('restart', 'primary')}</div>
    </div>
  `;

  const find = (id) => root.querySelector(`#${id}`);
  const money = find('hud-money');
  const ammo = find('hud-ammo');
  const wanted = find('hud-wanted');
  const job = find('hud-job');
  const objectiveText = find('hud-objective');
  const objectiveName = find('objective-name');
  const healthBar = find('bar-health');
  const armorBar = find('bar-armor');
  const speed = find('hud-speed');
  const crosshair = find('crosshair');
  const hint = find('hint');
  const toast = find('toast');
  const dialogue = find('dialogue');
  const mapWeather = find('map-weather');
  const map = find('minimap');
  const mapCtx = map.getContext('2d');
  const panels = ['hud-money-panel', 'hud-status-panel', 'hud-map-panel', 'hud-ammo-panel'].map(find);

  function drawMinimap(state, extras) {
    if (!extras.city) return;
    const city = extras.city;
    const size = map.width;
    const s = size / city.width;
    const P = (x, z) => [size / 2 + x * s, size / 2 + z * s];
    mapCtx.fillStyle = '#e8ddc4';
    mapCtx.fillRect(0, 0, size, size);
    mapCtx.fillStyle = 'rgba(122,106,86,0.45)';
    for (const road of city.roads) {
      const [x, z] = P(road.x, road.z);
      mapCtx.fillRect(x - road.w * s / 2, z - road.d * s / 2, road.w * s, road.d * s);
    }
    mapCtx.fillStyle = 'rgba(70,125,81,0.5)';
    for (const park of city.parks) {
      const [x, z] = P(park.x, park.z);
      mapCtx.fillRect(x - park.w * s / 2, z - park.d * s / 2, park.w * s, park.d * s);
    }
    const hb = city.harbor;
    const [hx, hz] = P(hb.x, hb.z);
    mapCtx.fillStyle = 'rgba(54,168,159,0.65)';
    mapCtx.fillRect(hx - hb.w * s / 2, hz - hb.d * s / 2, hb.w * s, hb.d * s);
    const goal = extras.objective;
    if (goal) {
      const [x, z] = P(goal.x, goal.z);
      mapCtx.fillStyle = '#ffd166';
      mapCtx.beginPath(); mapCtx.arc(x, z, 4.5, 0, Math.PI * 2); mapCtx.fill();
      mapCtx.strokeStyle = '#071a24'; mapCtx.lineWidth = 1; mapCtx.stroke();
    }
    for (const cop of state.police || []) {
      const [x, z] = P(cop.x, cop.z);
      mapCtx.fillStyle = '#4fa8ff';
      mapCtx.fillRect(x - 2, z - 2, 4, 4);
    }
    const p = state.player;
    const [px, pz] = P(p.x, p.z);
    mapCtx.save();
    mapCtx.translate(px, pz);
    mapCtx.rotate(-p.angle);
    mapCtx.fillStyle = p.onFoot ? '#ffd166' : '#ff6b4a';
    mapCtx.beginPath();
    mapCtx.moveTo(7, 0); mapCtx.lineTo(-5, 4.5); mapCtx.lineTo(-5, -4.5);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
  }

  function render(state, screen, extras = {}) {
    for (const el of root.querySelectorAll('.screen')) {
      el.classList.toggle('hidden', el.dataset.screen !== screen);
    }
    const inWorld = screen === 'play' || screen === 'paused';
    for (const panel of panels) panel.classList.toggle('hidden', !inWorld);
    crosshair.classList.toggle('hidden', screen !== 'play');
    crosshair.classList.toggle('aim', Boolean(extras.mouse && extras.mouse.aim));

    money.textContent = `$${Math.max(0, Math.floor(state.money || 0))}`;
    ammo.textContent = `${Math.max(0, Math.floor(state.ammo || 0))} / 12`;
    const stars = Math.max(0, Math.min(5, Math.floor(state.wanted || 0)));
    wanted.innerHTML = '★'.repeat(stars) + `<span class="star-off">${'☆'.repeat(5 - stars)}</span>`;
    const mission = MISSIONS[state.missionIndex];
    job.textContent = state.won ? 'All jobs complete' : mission ? `${mission.title} · ${mission.kind}` : 'Free roam';
    objectiveText.textContent = extras.objective?.label || '';
    objectiveName.textContent = extras.objective?.label || '';
    healthBar.style.width = `${Math.max(0, Math.min(100, state.health || 0))}%`;
    armorBar.style.width = `${Math.max(0, Math.min(100, state.armor || 0))}%`;
    speed.innerHTML = state.player?.onFoot
      ? 'On foot'
      : `${Math.round(Math.abs(state.player?.speed || 0) * 3.6)} <small>km/h</small>`;
    mapWeather.textContent = state.rain ? 'Haze' : 'Clear';
    hint.textContent = screen === 'play' ? (state.hint || '') : '';
    toast.classList.toggle('hidden', !state.toast || screen !== 'play');
    toast.textContent = state.toast || '';
    const line = Array.isArray(state.dialogue) ? state.dialogue[0] : null;
    dialogue.classList.toggle('hidden', !line || screen !== 'play');
    if (line) {
      dialogue.querySelector('.who').textContent = line.who;
      dialogue.querySelector('.line').textContent = line.text;
    }
    const cont = find('btn-continue');
    if (cont) cont.disabled = !extras.saveExists;
    const mute = find('btn-mute');
    if (mute) mute.textContent = extras.muted ? 'Sound: off' : LABELS.mute;
    const win = find('win-summary');
    if (win) win.textContent = `Every job paid. You finished with $${Math.floor(state.money || 0)} in Cielo Bay.`;
    if (inWorld) drawMinimap(state, extras);
  }

  return { render, buttons: BUTTON_IDS.slice() };
}
