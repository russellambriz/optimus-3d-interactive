// Info cards. Facts are kept general and attributed; uncertain items are labeled as such.
export const PARTS = {
  head: {
    kicker: 'Perception',
    title: 'Head & Vision',
    body: 'Optimus sees the world mainly through cameras behind its glossy black faceplate, following the same vision-first approach Tesla uses in its cars. Gen 2 added an actuated neck so the head can turn and tilt on its own.',
    tags: ['Camera-based vision', '2-DoF neck (Gen 2)', 'FSD-style neural nets'],
  },
  torso: {
    kicker: 'Power & Compute',
    title: 'Torso',
    body: 'The torso holds the battery pack, power electronics and the onboard computer. Tesla described a ~2.3 kWh pack at AI Day 2022, and the computer is based on Tesla\u2019s vehicle hardware. Keeping this mass in the middle of the body helps with balance. Switch on X-ray to see a stylized pack.',
    tags: ['~2.3 kWh pack (2022 figure)', 'Tesla SoC compute', 'Wi-Fi / LTE (reported)'],
  },
  battery: {
    kicker: 'X-ray view',
    title: 'Battery Pack',
    body: 'This is a stylized look at the pack built into the chest. Tesla says it uses its EV know-how in cells, thermal management and safety to run the robot for a full work shift. The real cell layout hasn\u2019t been published, so this one is illustrative.',
    tags: ['~2.3 kWh (AI Day 2022)', 'Integrated BMS', 'Illustrative layout'],
  },
  arm: {
    kicker: 'Actuation',
    title: 'Arms & Actuators',
    body: 'Tesla designs its own rotary and linear actuators for Optimus instead of buying off-the-shelf servos. The 2022 prototype was shown with 28 structural actuators across the body. The arms use rotary joints at the shoulder, elbow and wrist.',
    tags: ['In-house actuators', '28 structural actuators (2022)', 'Rotary joints'],
  },
  hand: {
    kicker: 'Dexterity',
    title: 'Hands',
    body: 'The Gen 2 hands (Dec 2023) had 11 degrees of freedom and tactile sensing in the fingers, gentle enough to handle an egg (try the Egg grip preset). Tesla later showed a newer hand reported at around 22 DoF, with the actuators moved into the forearm.',
    tags: ['11 DoF (Gen 2)', '~22 DoF hand (reported)', 'Tactile fingertips'],
  },
  leg: {
    kicker: 'Locomotion',
    title: 'Legs',
    body: 'The legs combine rotary actuators at the hips with linear actuators at the knees and ankles. The calf rods in this model are stylized. Tesla said Gen 2 walks about 30% faster than earlier versions and weighs about 10 kg less.',
    tags: ['Linear actuators', '~30% faster walk (Gen 2)', '~10 kg lighter (Gen 2)'],
  },
  foot: {
    kicker: 'Balance',
    title: 'Feet',
    body: 'Gen 2 introduced human-like feet with force/torque sensing and jointed toe sections. These help with balance, smoother steps and sensing the ground underfoot.',
    tags: ['Force/torque sensing', 'Articulated toes', 'Human-like geometry'],
  },
};
export const PART_ORDER = ['head', 'torso', 'arm', 'hand', 'leg', 'foot'];
