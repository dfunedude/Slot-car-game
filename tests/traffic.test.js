// Where slots cross, computer drivers give way to each other, and after a collision the marshal puts
// the cars back one at a time so they don't run straight into each other again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Layout } from '../src/core/layout.js';
import { PRESETS, buildPreset } from '../src/core/presets.js';
import { SPECS } from '../src/core/specs.js';
import { Heat } from '../src/core/heat.js';

function heatOn(key, drivers, cars = ['f1', 'pony', 'canam', 'aero']) {
  const L = new Layout(); buildPreset(L, key);
  const h = new Heat(L, () => 0.5);
  drivers.forEach((d, i) => { h.racers[i].setSpec(SPECS[cars[i]]); h.setDriver(i, d); });
  h.begin('practice');
  const log = { hits: 0, offs: 0 };
  h.onEvent = kind => { if (kind === 'collision') log.hits++; if (kind === 'off') log.offs++; };
  return { h, log };
}
const run = (h, secs) => { for (let t = 0; t < secs; t += 1 / 60) h.update(1 / 60); };

test('two computers on the figure eight never collide at the crossing', () => {
  for (const pair of [['ace', 'ace'], ['ace', 'rookie'], ['pro', 'pro']]) {
    const { h, log } = heatOn('fig8', pair);
    run(h, 70);
    assert.equal(log.hits, 0, `${pair}: ${log.hits} collisions`);
    assert.ok(h.race.timing[0].laps > 10 && h.race.timing[1].laps > 10, `${pair}: laps ${h.race.timing.map(t => t.laps)}`);
  }
});

for (const key of Object.keys(PRESETS).filter(k => PRESETS[k].lanes === 4)) {
  test(`four computers race ${PRESETS[key].name} cleanly`, () => {
    const { h, log } = heatOn(key, ['ace', 'pro', 'rookie', 'ace']);
    run(h, 45);
    assert.equal(log.hits, 0, `${log.hits} collisions`);
    assert.equal(log.offs, 0, `${log.offs} came off`);
    for (let i = 0; i < 4; i++) assert.ok(h.race.timing[i].laps >= 5, `lane ${i + 1}: ${h.race.timing[i].laps} laps`);
  });
}

test('after a collision two computers are put back one at a time and race on', () => {
  // two players hold a steady trigger and meet at the crossing sooner or later
  const { h, log } = heatOn('fig8', ['human', 'human']);
  h.trig = [0.55, 0.55, 0, 0];
  let t = 0;
  while (!log.hits && t < 60) { h.update(1 / 60); t += 1 / 60; }
  assert.equal(log.hits, 1, 'the cars should have met');
  // now hand both controllers to the computer, as when two computers collide
  h.setDriver(0, 'ace'); h.setDriver(1, 'ace');
  let both = false, backAt = [null, null];
  for (t = 0; t < 30; t += 1 / 60) {
    h.update(1 / 60);
    h.racers.slice(0, 2).forEach((r, i) => { if (backAt[i] === null && r.state === 'reset') backAt[i] = t; });
    both = both || h.racers.slice(0, 2).every(r => r.state === 'reset');
  }
  assert.ok(!both, 'both cars were being put back at the same time');
  assert.ok(backAt[0] !== null && backAt[1] !== null, 'both cars were put back');
  assert.ok(Math.abs(backAt[0] - backAt[1]) > 0.7, `put back ${backAt[0].toFixed(2)} s and ${backAt[1].toFixed(2)} s`);
  assert.equal(log.hits, 1, `${log.hits - 1} more collisions after the first`);
  assert.ok(h.racers.slice(0, 2).every(r => r.onTrack));
});
