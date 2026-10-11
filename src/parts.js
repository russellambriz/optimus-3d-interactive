// Info cards for the Gen 3 model. Facts are attributed; anything not officially confirmed is marked "reported".
export const PARTS = {
  head: {
    kicker: 'Perception',
    title: 'Head & Vision',
    body: 'Optimus sees mainly through cameras behind its face, using the same vision-first neural-network approach as Tesla FSD. This model follows the Gen 3 renders found in Tesla\u2019s app: an all-black head with a mirror-gloss faceplate and a thin gold pinstripe around the face.',
    tags: ['Camera-based vision', 'FSD-style neural nets', 'Gen 3 look from app renders (reported)'],
  },
  torso: {
    kicker: 'Power & Compute',
    title: 'Torso',
    body: 'The torso holds the battery pack, power electronics and the onboard AI computer. Tesla quoted a ~2.3 kWh pack at AI Day 2022 but hasn\u2019t published a Gen 3 figure. The gold chest plate, black yoke and black abdomen match the Gen 3 app renders. Turn on X-ray to see a stylized pack.',
    tags: ['~2.3 kWh (2022 figure)', 'Gen 3 pack: not published', 'Gold + matte black panels'],
  },
  battery: {
    kicker: 'X-ray view',
    title: 'Battery Pack',
    body: 'This is a stylized pack in the chest. Tesla builds on its EV experience in cells, thermal management and safety. It hasn\u2019t published a cell layout or capacity for Gen 3, so this view is illustrative.',
    tags: ['~2.3 kWh (AI Day 2022)', 'Integrated BMS', 'Illustrative layout'],
  },
  arm: {
    kicker: 'Actuation',
    title: 'Arms & Forearm Actuators',
    body: 'In Gen 3 the hand\u2019s actuators sit in the forearm, which is why the forearm is so bulky. Musk said each forearm and hand has 25 actuators (50 in total). Tesla\u2019s April 2026 patent filings describe 23 hand linear actuators and 2 wrist linear actuators arranged around a central rotary actuator. Switch on X-ray to see the stylized forearm pack.',
    tags: ['25 actuators per forearm + hand', '23 hand + 2 wrist (patents)', 'Black elbow band'],
  },
  hand: {
    kicker: 'Dexterity',
    title: 'Hands',
    body: 'Tesla says the new Optimus hand has 22 degrees of freedom. Its patents describe a tendon-driven design: about 4 DoF per finger plus 2 at the wrist, with thin cables running from the forearm actuators through the wrist into the fingers. The Gen 2 hand had 11 DoF. This model has 15 jointed segments per hand.',
    tags: ['22 DoF hand (Tesla)', 'Tendon-driven (patents)', 'Gen 2: 11 DoF'],
  },
  leg: {
    kicker: 'Locomotion',
    title: 'Legs',
    body: 'The Gen 3 renders show a much more enclosed lower body than earlier versions. Flexible covers seal the hips and upper thighs, and matte black fairings on the lower legs replace the exposed linkages of Gen 2.5. Leg actuator specs for Gen 3 haven\u2019t been published.',
    tags: ['Enclosed hips (renders)', 'Black shin fairings', 'Specs not published'],
  },
  foot: {
    kicker: 'Balance',
    title: 'Feet',
    body: 'Gen 2 introduced human-like feet with force/torque sensing and jointed toes. In the Gen 3 renders the feet have a smooth, boot-like black cover. The internal foot design hasn\u2019t been published, so this model follows the outer shape.',
    tags: ['Force/torque sensing (Gen 2)', 'Boot-like cover (renders)', 'Internals not published'],
  },
};
export const PART_ORDER = ['head', 'torso', 'arm', 'hand', 'leg', 'foot'];
