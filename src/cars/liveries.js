// ===== cars/liveries: the paint schemes each car comes in, and the cars' catalogue =====
// base: body colour; a, b: stripes and panels; num, round, numC: the racing number, its roundel and
// figure colours; sponsor and text: the lettering; helmet and suit: the driver; wingC: the wing.
// Sponsors and teams are made up.
import { SPECS } from '../core/specs.js';

export const LIVERIES = {
  f1: [
    { id: 'rosso', name: 'Rosso', base: 0xc41a14, a: 0xf2ede2, num: 12, round: 0xf2ede2, numC: 0x111111, sponsor: 'VELOX', text: 0xf2ede2, helmet: 0xf2c21b, suit: 0xc41a14 },
    { id: 'azure', name: 'Azure', base: 0x1f54a8, a: 0xf2c21b, num: 5, round: 0xf2ede2, numC: 0x1f54a8, sponsor: 'BLUE STREAK', text: 0xf2c21b, helmet: 0xf2ede2, suit: 0x1f54a8, wingC: 0xf2c21b },
    { id: 'verde', name: 'Verde', base: 0x1f5f3a, a: 0xf2ede2, num: 21, round: 0xf2ede2, numC: 0x1f5f3a, sponsor: 'TRIDENT', text: 0xf2ede2, helmet: 0xd8461f, suit: 0xe8e2d4 },
  ],
  canam: [
    { id: 'sunburst', name: 'Sunburst', base: 0xf07c12, a: 0x1a1a1a, b: 0xf07c12, num: 4, round: 0xf2ede2, numC: 0x111111, sponsor: 'APEX', text: 0x1a1a1a, helmet: 0xf2ede2, suit: 0xf07c12 },
    { id: 'polar', name: 'Polar', base: 0xeeeae0, a: 0x1d4fb8, b: 0xc8281c, num: 7, round: 0x1d4fb8, numC: 0xf2ede2, sponsor: 'KESTREL', text: 0x1d4fb8, helmet: 0x1d4fb8, suit: 0xeeeae0, wingC: 0x1d4fb8 },
    { id: 'midnight', name: 'Midnight', base: 0x14161c, a: 0xd8b23a, b: 0x14161c, num: 48, round: 0xd8b23a, numC: 0x14161c, sponsor: 'NIGHTHAWK', text: 0xd8b23a, helmet: 0xd8b23a, suit: 0x14161c, wingC: 0x14161c },
  ],
  longtail: [
    { id: 'salt', name: 'Salt Flat', base: 0xeeeae0, a: 0xc8281c, b: 0xeeeae0, num: 23, round: 0xeeeae0, numC: 0x111111, sponsor: 'ZENITH OIL', text: 0x111111, helmet: 0xc8281c, suit: 0xeeeae0 },
    { id: 'quick', name: 'Quicksilver', base: 0xa9adb3, a: 0x1d4fb8, b: 0x1d4fb8, num: 3, round: 0xeeeae0, numC: 0x1d4fb8, sponsor: 'MERIDIAN', text: 0x1d4fb8, helmet: 0xeeeae0, suit: 0x1d4fb8 },
    { id: 'forest', name: 'Forest', base: 0x2a5a32, a: 0xf2c21b, b: 0xf2c21b, num: 17, round: 0xf2c21b, numC: 0x2a5a32, sponsor: 'GREEN LINE', text: 0xf2c21b, helmet: 0xf2c21b, suit: 0x2a5a32 },
  ],
  pony: [
    { id: 'grabber', name: 'Grabber Blue', base: 0x2a78c8, a: 0xf2ede2, num: 15, round: 0xf2ede2, numC: 0x111111, sponsor: 'SURE-GRIP', text: 0xf2ede2, square: false },
    { id: 'plum', name: 'Plum', base: 0x5a2470, a: 0x111111, num: 2, round: 0xf2ede2, numC: 0x5a2470, sponsor: 'HEMI-HOT', text: 0xf2ede2, square: true },
    { id: 'hornet', name: 'Hornet', base: 0xf2c21b, a: 0x111111, num: 77, round: 0x111111, numC: 0xf2c21b, sponsor: 'STINGER', text: 0x111111 },
  ],
  aero: [
    { id: 'firecracker', name: 'Firecracker', base: 0xc8281c, a: 0xf2ede2, num: 71, round: 0xf2ede2, numC: 0xc8281c, sponsor: 'RED LINE', text: 0xf2ede2 },
    { id: 'skyline', name: 'Skyline', base: 0x4a9ad8, a: 0x1a3a7a, num: 22, round: 0xf2ede2, numC: 0x1a3a7a, sponsor: 'STARFIRE', text: 0xf2ede2 },
    { id: 'bumblebee', name: 'Bumblebee', base: 0xf2c21b, a: 0x111111, num: 9, round: 0x111111, numC: 0xf2c21b, sponsor: 'BEE LINE', text: 0x111111 },
  ],
  van: [
    { id: 'sunset', name: 'Sunset', base: 0x3a2418, stripes: [0xf2c21b, 0xf07c12, 0xc8281c], sponsor: 'Keep on Truckin\'', text: 0xf2c21b, style: 'stripes' },
    { id: 'hotrod', name: 'Hot Rod', base: 0x121214, stripes: [0xc8281c, 0xf07c12, 0xf2c21b], sponsor: 'Midnight Rider', text: 0xeeeae0, style: 'flames' },
    { id: 'earth', name: 'Earth Tone', base: 0xc8a46a, stripes: [0x5a3418, 0x8a5a28, 0xd87c28], sponsor: 'Mellow Yellow', text: 0x5a3418, style: 'stripes' },
  ],
};
// every car the garage offers, in shelf order
export const CARS = Object.keys(SPECS).map(key => ({ key, ...SPECS[key], liveries: LIVERIES[key] }));
// a livery's swatch colours for the deck: the body and its main stripe
export function swatch(key, li) {
  const L = LIVERIES[key][li] || LIVERIES[key][0];
  return [L.base, L.a ?? (L.stripes && L.stripes[1]) ?? L.base];
}
