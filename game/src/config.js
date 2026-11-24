// PALMERA HEAT — every tuning number, colour and name in one place.
// The world is a fixed 3200x2400 coastal city; the camera shows part of it at a time,
// so nothing below depends on the size of the player's screen.
window.PH = window.PH || {};

PH.WORLD = { width: 3200, height: 2400, waterY: 2300, sandY: 2052 };

/** Road centre lines: verticals run the city's height, horizontals stop at the beach road. */
PH.V_ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
PH.H_ROADS = [200, 600, 1000, 1400, 1800, 2150];
PH.ROAD = { width: 96, lane: 24, sidewalk: 14 };

/** The simulation's fixed step: 60 updates a second whatever the display rate. */
PH.STEP = 1 / 60;

PH.PLAYER = {
  radius: 13, walkSpeed: 178, runSpeed: 262, health: 100,
  meleeRange: 46, meleeDamage: 34, enterRange: 58,
};

PH.PISTOL = { damage: 34, range: 560, spread: 0.035, cooldown: 0.22, mag: 12, reloadTime: 1.1 };

/** Car models: size, pace and manners differ so stealing a different car feels different. */
PH.CAR_TYPES = {
  compact: { name: 'Pico', length: 74, width: 36, topSpeed: 342, reverse: 110, accel: 300, grip: 7.5, drift: 0.86, health: 100, colours: ['#ff9fb2', '#ffd6a5', '#caffbf', '#a0c4ff', '#ffc6ff'] },
  sedan: { name: 'Sable', length: 84, width: 38, topSpeed: 384, reverse: 120, accel: 330, grip: 8.5, drift: 0.9, health: 120, colours: ['#bdb2ff', '#a2d2ff', '#ffc8dd', '#e8e8ec', '#90e0c0'] },
  taxi: { name: 'Palmera Cab', length: 84, width: 38, topSpeed: 372, reverse: 120, accel: 326, grip: 8.5, drift: 0.9, health: 120, colours: ['#f2b705'] },
  sports: { name: 'Vireo GT', length: 82, width: 38, topSpeed: 512, reverse: 140, accel: 470, grip: 6.2, drift: 0.72, health: 90, colours: ['#ff5d8f', '#ffea00', '#00f5d4', '#f15bb5', '#9b5de5'] },
  pickup: { name: 'Mule', length: 90, width: 40, topSpeed: 330, reverse: 130, accel: 300, grip: 9.0, drift: 0.93, health: 170, colours: ['#f4a259', '#8ac926', '#6a4c93', '#e9d8a6'] },
  police: { name: 'Interceptor', length: 86, width: 38, topSpeed: 468, reverse: 150, accel: 440, grip: 8.8, drift: 0.9, health: 150, colours: ['#20242c'] },
};

/** How hot the law gets: cars and foot officers the city sends at each star. */
PH.WANTED = {
  policeCars: [0, 1, 2, 3, 4, 6],
  footCops: [0, 0, 2, 3, 4, 6],
  copShotsFrom: 3,          // stars at which foot officers open fire
  decaySeconds: [0, 9, 14, 20, 28, 40], // unseen time before a star drops
  bustSeconds: 1.6,          // standing caught this long at low speed ends the run
};

PH.PALETTE = {
  water: '#1d6a96', waterDeep: '#155a85', sand: '#ecd096', sandWet: '#dfc084',
  grass: '#79a86b', plaza: '#cbb9a0', plazaAlt: '#c2ad92',
  asphalt: '#3d4149', asphaltEdge: '#33373e', lane: '#e9e2c8', crosswalk: '#d8d8d2',
  sidewalk: '#b7ab97', kerb: '#9c9078',
  roofShadow: 'rgba(46,32,54,0.35)',
  palmTrunk: '#7a5a3c', palmLeaf: '#3e7d44', palmLeafLight: '#57a05a',
  lampPost: '#4c4f57', lampGlow: '#ffd98a',
  text: '#fdf6ec', muted: '#cdbfa8', gold: '#ffc93c', danger: '#ef476f', police: '#4da3ff',
};

PH.FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Building sign names, invented for Palmera's shops and clubs. */
PH.SIGNS = [
  'CLUB SIRENA', 'HOTEL CORAL', 'TACO BRISA', 'PALMERA PAWN', 'CAFE LITORAL', 'GYM TITAN',
  'BANCO DEL SOL', 'MARINA MOTORS', 'DISCO FARO', 'PIZZA OLE', 'HOTEL BRISA', 'SURF SHACK',
  'LA OFICINA', 'BAR TIBURON', 'FLORISTERIA', 'CINE PALMERA', 'TALLER RUIZ', 'JOYERIA LUNA',
  'FARMACIA SOL', 'MERCADO 9', 'CLUB VELERO', 'HELADERIA MIA', 'LIBROS MAR', 'PELUQUERIA REY',
];

/** Where the story lives: named spots the missions use. */
PH.SPOTS = {
  club: { x: 1156, y: 1466, label: 'Club Sirena' },
  docks: { x: 700, y: 2046, label: 'the Dockside warehouse' },
  marina: { x: 2538, y: 662, label: 'Marina Heights lookout' },
  safehouse: { x: 830, y: 1660, label: 'the Dockside safehouse' },
  pier: { x: 480, y: 2210, label: 'Palmera Pier' },
  hideout: { x: 2138, y: 1862, label: 'the Sunset Flats garage' },
};

PH.SAVE_KEY = 'palmera-heat.save.v1';
