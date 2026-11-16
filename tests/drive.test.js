// The computer drivers must get round every preset without coming off, flat out must come off on a
// tight circuit, and a car that comes off must be put back in its slot by a reset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Layout } from '../src/core/layout.js';
import { PRESETS, buildPreset } from '../src/core/presets.js';
import { SPECS } from '../src/core/specs.js';
import { Racer } from '../src/core/racer.js';
import { Race, gridPlace } from '../src/core/race.js';
import { SKILLS, aiTrigger } from '../src/core/ai.js';

function run(key, carKey, slot, skill, laps, maxT = 120) {
  const L = new Layout(); buildPreset(L, key);
  const race = new Race(); race.begin('practice');
  const r = new Racer(SPECS[carKey], slot);
  r.onLap = () => race.lap(slot);
  let offs = 0; r.onDeslot = () => offs++;
  gridPlace(L, r);
  const dt = 1 / 60;
  let t = 0, top = 0;
  while (race.timing[slot].laps < laps && t < maxT) {
    r.trigger = typeof skill === 'number' ? skill : aiTrigger(r, skill, dt, () => 0.5);
    r.step(dt, t); race.update(dt); t += dt; top = Math.max(top, r.v);
    if (r.state === 'fly' && r.resting) r.reset();
  }
  return { laps: race.timing[slot].laps, offs, best: race.timing[slot].best, top, t };
}

for (const key of Object.keys(PRESETS)) for (let slot = 0; slot < (PRESETS[key].lanes || 2); slot++) {
  test(`ace and rookie lap ${key} in lane ${slot + 1} without coming off`, () => {
    for (const carKey of Object.keys(SPECS)) for (const sk of ['ace', 'rookie']) {
      const res = run(key, carKey, slot, SKILLS[sk], 3);
      assert.equal(res.offs, 0, `${carKey} (${sk}) came off ${res.offs}×`);
      assert.equal(res.laps, 3, `${carKey} (${sk}) did ${res.laps} laps`);
    }
  });
}

test('flat out on the club circuit comes off, and a reset puts the car back', () => {
  const res = run('club', 'pony', 0, 1, 1, 60);
  assert.ok(res.offs > 0);
  assert.equal(res.laps, 1, 'it still finishes a lap after being put back');
});

test('the ace is faster than the rookie', () => {
  const a = run('road', 'f1', 0, SKILLS.ace, 3), b = run('road', 'f1', 0, SKILLS.rookie, 3);
  assert.ok(a.best < b.best, `${a.best} vs ${b.best}`);
});

test('lap times', () => {
  for (const key of Object.keys(PRESETS)) {
    const res = run(key, 'f1', 0, SKILLS.ace, 2);
    console.log(`  ${key}: best ${res.best.toFixed(2)} s, top ${res.top.toFixed(0)} in/s`);
  }
});
