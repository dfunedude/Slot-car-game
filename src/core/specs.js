// ===== core/specs: how each car drives (the models are in src/cars/) =====
// vmax: top speed, in/s. pull: how hard the motor chases the trigger (1/s). brake: the controller's
// dynamic brake when the trigger is let go (1/s). grip: sideways grip before the tail lets go, in/s².
// drift: how far the tail swings out near the limit (radians). tumble: how readily it rolls when it
// flies off (a tall van goes over, a wedge just spins). wb: guide pin to rear axle, inches.
export const SPECS = {
  f1: { name: 'Wedge F1', era: '1972 Formula car', vmax: 73, pull: 2.7, brake: 6.5, grip: 161, drift: 0.24, tumble: 0.3, wb: 1.75 },
  canam: { name: 'Can-Am Spyder', era: '1971 Group 7 sports racer', vmax: 76, pull: 2.9, brake: 6, grip: 151, drift: 0.3, tumble: 0.35, wb: 1.7 },
  longtail: { name: 'Long-tail Coupe', era: '1970 endurance prototype', vmax: 81, pull: 2.3, brake: 5.5, grip: 144, drift: 0.28, tumble: 0.4, wb: 1.8 },
  pony: { name: 'Pony Coupe', era: '1970 Trans-Am fastback', vmax: 70, pull: 2.6, brake: 6, grip: 137, drift: 0.42, tumble: 0.55, wb: 1.7 },
  aero: { name: 'Aero Stocker', era: '1970 winged superspeedway car', vmax: 84, pull: 2.2, brake: 5.2, grip: 128, drift: 0.36, tumble: 0.5, wb: 1.85 },
  van: { name: 'Street Van', era: '1977 custom van', vmax: 66, pull: 2.5, brake: 6.5, grip: 124, drift: 0.45, tumble: 0.95, wb: 1.5 },
};
// stat bars in the garage, 0 to 1
export function specBars(s) {
  return {
    speed: (s.vmax - 60) / 26,
    pickup: (s.pull - 2) / 1,
    grip: (s.grip - 116) / 50,
  };
}
