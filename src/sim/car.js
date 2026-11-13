// ===== sim/car: a car on the table: its model, set where its racer says, wheels turning, braids sparking =====
import * as THREE from 'three';
import { SPECS } from '../core/specs.js';
import { Racer, GUIDE } from '../core/racer.js';
import { scene } from '../render/stage.js';
import { TEX } from '../render/textures.js';
import { disposeModel } from '../render/kit.js';
import { BUILDERS } from '../cars/models.js';
import { LIVERIES } from '../cars/liveries.js';

const offRingMat = new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.8, depthWrite: false });
const offRingGeo = new THREE.RingGeometry(1.5, 1.8, 40).rotateX(-Math.PI / 2);
const carHitGeo = new THREE.BoxGeometry(3.4, 1.6, 2.2);

export class CarView {
  constructor(slot) {
    this.slot = slot;
    this.racer = new Racer(SPECS.f1, slot);
    this.root = new THREE.Group();
    this.body = null; this.axles = [];
    // a generous box to tap the car by, and a ring that pulses round it while it waits to be put back
    this.hit = new THREE.Mesh(carHitGeo, offRingMat);
    this.hit.visible = false; this.hit.position.y = 0.6; this.hit.userData.car = this;
    this.root.add(this.hit);
    this.ring = new THREE.Mesh(offRingGeo, offRingMat);
    this.ring.visible = false; this.ring.renderOrder = 4;
    scene.add(this.ring);
    // sparks off the pickup braids, bright in the dim room
    this.spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x9fc4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.spark.scale.setScalar(0.5);
    this.root.add(this.spark);
    this.root.visible = false;
    scene.add(this.root);
    this.key = null; this.li = 0;
  }
  setModel(key, li) {
    if (!BUILDERS[key]) key = 'f1';
    li = Math.max(0, Math.min(LIVERIES[key].length - 1, li | 0));
    if (key === this.key && li === this.li && this.body) return;
    if (this.body) { this.root.remove(this.body); disposeModel(this.body); }
    const m = BUILDERS[key](LIVERIES[key][li]);
    m.root.traverse(o => { if (o.isMesh) o.userData.car = this; });
    this.body = m.root; this.axles = m.axles;
    this.root.add(this.body);
    this.key = key; this.li = li;
    this.racer.setSpec(SPECS[key]);
    this.spark.position.set(this.racer.a + GUIDE, 0.04, 0);
  }
  // each frame, after the racer has moved: put the model where it is
  update(dt, waiting) {
    const r = this.racer, o = r.pose;
    this.root.visible = r.placed;
    if (!r.placed) { this.ring.visible = false; return; }
    this.root.position.set(o.x, o.y, o.z);
    this.root.rotation.set(o.roll, -o.h, o.pitch, 'YZX');
    // wheels: rolling on the track, spinning on in the air, still once it's come to rest
    const v = r.state === 'run' ? r.v : r.state === 'fly' && !r.fly.ground ? r.speedOff * 0.6 : 0;
    for (const ax of this.axles) ax.rotation.z -= v * dt / ax.userData.r;
    const sparking = r.state === 'run' && r.v > 8 && r.trigger > 0.15;
    this.spark.material.opacity = sparking ? Math.random() * (0.4 + 0.5 * r.trigger) : 0;
    this.spark.scale.setScalar(0.3 + Math.random() * 0.35);
    // the ring round a car that's come off, until someone puts it back
    const show = waiting && r.state === 'fly';
    this.ring.visible = show;
    if (show) {
      this.ring.position.set(o.x, o.y + 0.05, o.z);
      const s = 1 + 0.15 * Math.sin(performance.now() / 160);
      this.ring.scale.setScalar(s);
    }
  }
}
