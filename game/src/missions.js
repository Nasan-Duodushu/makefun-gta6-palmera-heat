// The story of Palmera Heat, in five short missions. Nia Solano, fresh off the bus
// with nothing, takes work from fixer Marisol Vega at Club Sirena: a meeting, a hot
// delivery, a rival to humble, a dockside shootout, and one last sunset run to the
// pier while the whole city watches. Between missions the next job waits at a gold
// marker; failing one (a timer, a wasted, a busted) sends you back to its start.
window.PH = window.PH || {};

function atSpot(G, spot, r) {
  return PH.dist(G.player.x, G.player.y, spot.x, spot.y) < (r || 70);
}

function finish(G, reward, lines) {
  G.cash += reward;
  G.audio.sting();
  G.banner('MISSION COMPLETE', PH.MISSIONS[G.mission.index].title + '  ·  +$' + reward);
  for (const [who, line] of lines) G.say(who, line);
  G.dropPickup(G.player.x + 24, G.player.y, 'health', 30);
  G.mission.index += 1;
  G.mission.phase = G.mission.index >= PH.MISSIONS.length ? 'done' : 'offer';
  G.mission.stage = 0;
  G.mission.data = {};
  PH.saveGame({ cash: G.cash, mission: G.mission.index, x: G.player.x, y: G.player.y });
}

const MISSIONS = [
  {
    title: 'Welcome to Palmera',
    start: PH.SPOTS.club, startLabel: 'Club Sirena',
    intro: [
      ['MARISOL', 'Nia Solano. Heard you fix problems and keep quiet about it.'],
      ['NIA', 'Heard right. What pays in this town?'],
      ['MARISOL', 'Everything, if you drive. Consider this a welcome gift.'],
    ],
    objective: () => 'Meet Marisol inside Club Sirena',
    setup() {},
    update(G) {
      if (atSpot(G, PH.SPOTS.club)) finish(G, 150, [['MARISOL', 'Good. Now let us see you earn.']]);
    },
  },
  {
    title: 'Hot Delivery',
    start: PH.SPOTS.docks, startLabel: 'the Dockside warehouse',
    intro: [
      ['MARISOL', 'A crate at the warehouse. Fragile, valuable, and not ours for long.'],
      ['MARISOL', 'Take it to the Marina Heights lookout. Fast — and the law will notice.'],
    ],
    objective: (G) => (G.mission.stage === 0
      ? 'Pick up the crate at the Dockside warehouse'
      : `Deliver the crate to Marina Heights — ${Math.max(0, Math.ceil(G.mission.timer))}s`),
    setup(G) { G.mission.stage = 0; },
    update(G) {
      const m = G.mission;
      if (m.stage === 0 && atSpot(G, PH.SPOTS.docks)) {
        m.stage = 1;
        m.timer = 150;
        PH.commitCrime(G, 1);
        G.say('NIA', 'Crate loaded. Marina Heights, on the clock.');
        G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= G.dt;
        if (atSpot(G, PH.SPOTS.marina)) {
          finish(G, 400, [['CONTACT', 'Right on time. Marisol pays her debts.']]);
        } else if (m.timer <= 0) G.failMission('The buyer left. The crate is worthless now.');
      }
    },
  },
  {
    title: 'Tail Spin',
    start: PH.SPOTS.hideout, startLabel: 'the Sunset Flats garage',
    intro: [
      ['MARISOL', 'A courier for the Faro crew keeps undercutting us in a yellow Vireo.'],
      ['MARISOL', 'Find him. Wreck the car — the driver walks away, understood?'],
    ],
    objective: (G) => (G.mission.stage === 0 ? 'Disable the Faro courier\u2019s Vireo GT' : 'Report back to Club Sirena'),
    setup(G) {
      const rival = PH.createCar('sports', 2400, 1800, Math.PI, '#ffd166');
      rival.driver = 'mission';
      rival.ai = { reverseAt: 0, stuckAt: 0 };
      G.cars.push(rival);
      G.mission.data.rival = rival;
      G.mission.stage = 0;
    },
    update(G, dt) {
      const m = G.mission;
      const rival = m.data.rival;
      if (m.stage === 0 && rival) {
        // The courier runs: away from the player, along whatever street he finds.
        const away = PH.angleTo(G.player.x, G.player.y, rival.x, rival.y);
        const steer = PH.clamp(PH.angleDelta(rival.angle, away) * 1.6, -1, 1);
        let throttle = 1;
        if (rival.ai.reverseAt > 0) { rival.ai.reverseAt -= dt; throttle = -1; }
        if (PH.carSpeed(rival) < 12) {
          rival.ai.stuckAt += dt;
          if (rival.ai.stuckAt > 1.2) { rival.ai.reverseAt = 0.6; rival.ai.stuckAt = 0; }
        } else rival.ai.stuckAt = 0;
        PH.stepCar(G, rival, { throttle, steer, handbrake: false }, dt);
        PH.carEffects(G, rival, dt);
        if (rival.dead || rival.health <= 25) {
          m.stage = 1;
          const driver = PH.makePed(rival.x + 24, rival.y, 'walker');
          driver.state = 'flee';
          driver.fleeAt = 4;
          driver.fleeX = G.player.x;
          driver.fleeY = G.player.y;
          G.peds.push(driver);
          G.say('COURIER', 'Keep the car! I am done, I am done!');
        }
      } else if (m.stage === 1 && atSpot(G, PH.SPOTS.club)) {
        finish(G, 650, [['MARISOL', 'The Faro crew just raised their prices. Wonder why.']]);
      }
    },
  },
  {
    title: 'Harbour Heat',
    start: PH.SPOTS.docks, startLabel: 'the Dockside warehouse',
    intro: [
      ['MARISOL', 'The Faro crew traced the crate. They are coming to the docks tonight.'],
      ['NIA', 'Then I will be at the docks tonight.'],
    ],
    objective: (G) => (G.mission.stage === 0
      ? `Hold the warehouse — ${G.mission.data.left || 4} of the Faro crew still standing`
      : 'Lose yourself at the Dockside safehouse'),
    setup(G) {
      G.mission.stage = 0;
      G.mission.data.left = 4;
      G.mission.data.hostiles = [];
      const spots = [[650, 2020], [760, 2060], [580, 2080], [860, 2100]];
      for (const [x, y] of spots) {
        const gunman = PH.makePed(x, y, 'gunman');
        gunman.hp = 70;
        gunman.shirt = '#5b2a86';
        G.peds.push(gunman);
        G.mission.data.hostiles.push(gunman);
      }
    },
    update(G) {
      const m = G.mission;
      if (m.stage === 0 && m.data.left <= 0) {
        m.stage = 1;
        PH.commitCrime(G, 3);
        G.say('MARISOL', 'Sirens, Nia. The safehouse — go!');
      } else if (m.stage === 1 && atSpot(G, PH.SPOTS.safehouse)) {
        finish(G, 900, [['MARISOL', 'The docks are ours again. One last job, the big one.']]);
      }
    },
  },
  {
    title: 'Last Sunset Run',
    start: PH.SPOTS.club, startLabel: 'Club Sirena',
    intro: [
      ['MARISOL', 'Everything we earned is in one bag, and Captain Ruiz knows my name now.'],
      ['MARISOL', 'Drive me to Palmera Pier. A boat, a sunset, a clean horizon.'],
    ],
    objective: (G) => (G.mission.stage === 0
      ? 'Pick Marisol up at Club Sirena'
      : `Get Marisol to Palmera Pier — ${Math.max(0, Math.ceil(G.mission.timer))}s`),
    setup(G) { G.mission.stage = 0; },
    update(G) {
      const m = G.mission;
      if (m.stage === 0 && atSpot(G, PH.SPOTS.club)) {
        m.stage = 1;
        m.timer = 180;
        PH.commitCrime(G, 2);
        G.say('MARISOL', 'That is Ruiz behind us. Drive, Nia. Drive!');
      } else if (m.stage === 1) {
        m.timer -= G.dt;
        if (!m.data.heat && PH.dist(G.player.x, G.player.y, PH.SPOTS.pier.x, PH.SPOTS.pier.y) < 900) {
          m.data.heat = true;
          PH.commitCrime(G, 4);
        }
        if (atSpot(G, PH.SPOTS.pier, 90)) {
          G.wanted.stars = 0;
          finish(G, 1500, [
            ['MARISOL', 'Palmera is yours now. Spend it loud.'],
            ['NIA', 'Free roam, then. The city keeps turning.'],
          ]);
        } else if (m.timer <= 0) G.failMission('The boat left without you.');
      }
    },
  },
];

PH.MISSIONS = MISSIONS;

PH.createMissionState = function createMissionState() {
  return { index: 0, phase: 'offer', stage: 0, timer: 0, data: {} };
};

/** The gold marker the HUD and minimap point at, or null between stories. */
PH.missionTarget = function missionTarget(G) {
  const m = G.mission;
  if (m.phase === 'done') return null;
  const mission = MISSIONS[m.index];
  if (m.phase === 'offer') return mission.start;
  if (m.index === 1) return m.stage === 0 ? PH.SPOTS.docks : PH.SPOTS.marina;
  if (m.index === 2) return m.stage === 0 ? (m.data.rival || PH.SPOTS.hideout) : PH.SPOTS.club;
  if (m.index === 3) return m.stage === 0 ? PH.SPOTS.docks : PH.SPOTS.safehouse;
  if (m.index === 4) return m.stage === 0 ? PH.SPOTS.club : PH.SPOTS.pier;
  return mission.start;
};

PH.missionObjective = function missionObjective(G) {
  const m = G.mission;
  if (m.phase === 'done') return 'Palmera is yours — free roam';
  const mission = MISSIONS[m.index];
  if (m.phase === 'offer') return `${mission.title}: go to ${mission.startLabel}`;
  return mission.objective(G);
};

PH.updateMissions = function updateMissions(G, dt) {
  const m = G.mission;
  if (m.phase === 'done') return;
  const mission = MISSIONS[m.index];
  if (m.phase === 'offer') {
    if (atSpot(G, mission.start, 80)) {
      m.phase = 'active';
      m.stage = 0;
      m.data = {};
      for (const [who, line] of mission.intro) G.say(who, line);
      mission.setup(G);
      G.audio.sting();
    }
    return;
  }
  mission.update(G, dt);
};
