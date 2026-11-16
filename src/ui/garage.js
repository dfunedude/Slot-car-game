// ===== ui/garage: choosing each lane's car and its paint =====
import { specBars } from '../core/specs.js';
import { LANE_NAMES } from '../core/race.js';
import { CARS, LIVERIES, swatch } from '../cars/liveries.js';
import { css } from '../render/textures.js';
import { session, state } from '../state.js';
import { save } from '../storage.js';
import { $ } from './dom.js';
import { updateBoard } from './hud.js';
import { carIcon } from './icons.js';

export function buildGarage() {
  for (const c of CARS) {
    const b = document.createElement('button');
    b.className = 'chip car'; b.type = 'button'; b.dataset.car = c.key;
    b.innerHTML = `${carIcon(c.key)}<span>${c.name}</span>`;
    b.addEventListener('click', () => pickCar(c.key, state.garage[state.garageLane].key === c.key ? state.garage[state.garageLane].li : defaultPaint(c.key)));
    $('carSlot').appendChild(b);
  }
  const seg = $('laneSeg');
  LANE_NAMES.forEach((name, i) => {
    const b = document.createElement('button');
    b.className = 'seg-btn'; b.type = 'button'; b.dataset.lane = i; b.setAttribute('role', 'radio');
    b.innerHTML = `<span class="chip-dot ${name.toLowerCase()}"></span>${name}`;
    b.addEventListener('click', () => { state.garageLane = i; renderGarage(); });
    seg.appendChild(b);
  });
  renderGarage();
}
// a car new to a lane comes in a paint no other lane is using, if there's one left
function defaultPaint(key) {
  const used = state.garage.filter((g, i) => i !== state.garageLane && g.key === key).map(g => g.li);
  const free = LIVERIES[key].findIndex((L, li) => !used.includes(li));
  return free < 0 ? 0 : free;
}
export function pickCar(key, li) {
  const i = state.garageLane;
  state.garage[i] = { key, li };
  session.setCar(i, key, li);
  renderGarage(); updateBoard(0, true); save();
}
export function renderGarage() {
  // only the lanes the track has
  if (state.garageLane >= session.lanes) state.garageLane = 0;
  const i = state.garageLane, g = state.garage[i];
  document.querySelectorAll('#laneSeg .seg-btn').forEach(b => {
    b.hidden = +b.dataset.lane >= session.lanes;
    b.setAttribute('aria-checked', String(+b.dataset.lane === i));
  });
  document.querySelectorAll('.chip.car').forEach(b => b.classList.toggle('is-on', b.dataset.car === g.key));
  const paints = $('paints');
  paints.innerHTML = '';
  LIVERIES[g.key].forEach((L, li) => {
    const [a, b] = swatch(g.key, li);
    const btn = document.createElement('button');
    btn.className = 'paint'; btn.type = 'button';
    btn.setAttribute('aria-pressed', String(li === g.li));
    btn.innerHTML = `<span class="sw" style="background:linear-gradient(135deg, ${css(a)} 55%, ${css(b)} 55%)"></span>${L.name}`;
    btn.addEventListener('click', () => pickCar(g.key, li));
    paints.appendChild(btn);
  });
  const c = CARS.find(x => x.key === g.key), bars = specBars(c);
  const bar = v => `<span class="bar"><i style="width:${Math.round(Math.max(0.08, Math.min(1, v)) * 100)}%"></i></span>`;
  $('stats').innerHTML = `<span class="era">${c.era}</span><span>Speed</span>${bar(bars.speed)}<span>Pickup</span>${bar(bars.pickup)}<span>Grip</span>${bar(bars.grip)}`;
}
