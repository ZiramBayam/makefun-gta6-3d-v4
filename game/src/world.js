// Pure deterministic simulation: driving, traffic, police, gangsters, four missions and saves.
import { CITY, MISSIONS } from './config.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createWorld(city, random) {
  const half = city.width / 2;
  const solid = city.blocks.filter((b) => b.kind === 'building');
  const spawn = city.spawn;
  let nextId = 1;

  const state = {
    player: {
      x: spawn.x, z: spawn.z, angle: 0, onFoot: true, carId: null,
      health: 100, armor: 0, ammo: 12, speed: 0,
    },
    cars: [], peds: [], enemies: [], police: [], effects: [], pickups: [],
    missionIndex: 0, stage: 0, money: 250, wanted: 0,
    health: 100, armor: 0, ammo: 12, time: 0, won: false, rain: false,
    events: [], dialogue: null, toast: null, hint: '',
  };

  const event = (type, extra = {}) => {
    state.events.push({ type, ...extra });
    if (state.events.length > 96) state.events.shift();
  };
  const toast = (text) => { state.toast = text; state.toastT = 2.8; event('toast', { text }); };

  // Circle against the building AABBs keeps feet and bumpers out of walls.
  const resolve = (p, radius) => {
    for (const b of solid) {
      const minX = b.x - b.w / 2 - radius, maxX = b.x + b.w / 2 + radius;
      const minZ = b.z - b.d / 2 - radius, maxZ = b.z + b.d / 2 + radius;
      if (p.x <= minX || p.x >= maxX || p.z <= minZ || p.z >= maxZ) continue;
      const margins = [p.x - minX, maxX - p.x, p.z - minZ, maxZ - p.z];
      const smallest = margins.indexOf(Math.min(...margins));
      if (smallest === 0) p.x = minX; else if (smallest === 1) p.x = maxX;
      else if (smallest === 2) p.z = minZ; else p.z = maxZ;
      return true;
    }
    return false;
  };

  const spawnCar = (kind, x, z, axis, dir, parked = false) => {
    const car = {
      id: nextId++, kind, x, z,
      angle: axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: parked ? 0 : random.range(13, 21),
      dir, axis, health: 100, exploded: false, parked, siren: false,
    };
    state.cars.push(car);
    return car;
  };

  // A parked car beside the spawn makes vehicle entry immediately discoverable.
  const starter = spawnCar('sedan', spawn.x + 5, spawn.z + 4, 'x', 1, true);
  starter.tint = 'ivory';
  for (let i = 0; i < 18; i++) {
    const axis = random.chance(0.5) ? 'x' : 'z';
    const dir = random.chance(0.5) ? 1 : -1;
    const lane = -half + random.int(0, 9) * CITY.block + (dir > 0 ? 9 : -9);
    const along = random.range(-half + 30, half - 30);
    const kind = random.pick(['sedan', 'sedan', 'taxi', 'van', 'sedan']);
    spawnCar(kind, axis === 'x' ? along : lane, axis === 'x' ? lane : along, axis, dir);
  }

  for (let i = 0; i < 34; i++) {
    const axis = random.chance(0.5) ? 'x' : 'z';
    const dir = random.chance(0.5) ? 1 : -1;
    const lane = -half + random.int(0, 9) * CITY.block + (dir > 0 ? 19 : -19);
    const along = random.range(-half + 20, half - 20);
    state.peds.push({
      id: nextId++, x: axis === 'x' ? along : lane, z: axis === 'x' ? lane : along,
      axis, dir, speed: random.range(2.4, 4.4), kind: 'civilian',
      angle: dir > 0 ? 0 : Math.PI, phase: random.range(0, 6.28),
    });
  }

  const livingEnemies = () => state.enemies.filter((e) => e.state !== 'down').length;
  const runner = () => state.peds.find((p) => p.runner && p.kind !== 'down');

  function spawnGangsters(count, spot) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      state.enemies.push({
        id: nextId++, kind: 'gangster',
        x: spot.x + Math.cos(a) * 16, z: spot.z + Math.sin(a) * 16,
        angle: a + Math.PI, health: 100, state: 'idle', cooldown: random.range(0.3, 1.2),
        hit: 0, money: random.int(90, 220),
      });
    }
  }

  function spawnRunner() {
    const spot = city.objectiveSpots.runner;
    state.peds.push({
      id: nextId++, x: spot.x, z: spot.z, axis: 'x', dir: 1,
      speed: 9.5, kind: 'runner', runner: true, angle: 0, phase: 0,
    });
  }

  function spawnVan() {
    const spot = city.objectiveSpots.van;
    spawnCar('van', spot.x, spot.z, 'z', 1, true);
  }

  function startNextMission() {
    if (state.missionIndex >= MISSIONS.length) {
      state.won = true;
      event('win');
      return;
    }
    const mission = MISSIONS[state.missionIndex];
    state.stage = 0;
    state.dialogue = mission.dialogue;
    state.enemies.length = 0;
    if (mission.kind === 'theft') {
      spawnGangsters(2, city.objectiveSpots.van);
      spawnVan();
    } else if (mission.kind === 'chase') {
      spawnRunner();
    } else if (mission.kind === 'fight') {
      spawnGangsters(4, city.objectiveSpots.plaza);
    }
    event('mission', { index: state.missionIndex, title: mission.title });
  }

  function completeMission() {
    const mission = MISSIONS[state.missionIndex];
    state.money += mission.reward;
    toast(`${mission.title} · +$${mission.reward}`);
    event('reward', { amount: mission.reward });
    state.missionIndex++;
    state.dialogue = null;
    startNextMission();
  }

  function objective() {
    const i = state.missionIndex;
    const spots = city.objectiveSpots;
    if (i >= MISSIONS.length || state.won) return null;
    if (i === 0) {
      return state.stage === 0
        ? { ...spots.pickup, label: 'Collect the parcel · Nia Vale' }
        : { ...spots.deliver, label: 'Deliver to Solano Plaza' };
    }
    if (i === 1) {
      return state.stage === 0
        ? { ...spots.van, label: livingEnemies() ? 'Clear the pier crew' : 'Take the harbour van' }
        : { ...spots.garage, label: 'Drive the van to the Puerto Alto garage' };
    }
    if (i === 2) {
      const r = runner();
      return r
        ? { x: r.x, z: r.z, label: 'Catch the causeway runner' }
        : { ...spots.runner, label: 'Find the runner' };
    }
    return { ...spots.plaza, label: `Clear the plaza · ${livingEnemies()} left` };
  }

  function checkMission() {
    if (state.won) return;
    const i = state.missionIndex;
    const op = objective();
    if (!op) return;
    const radius = i === 1 && state.stage === 0 ? 15 : i === 2 ? 10 : i === 3 ? 16 : 11;
    if (distance(state.player, op) > radius) return;
    if (i === 0) {
      if (state.stage === 0) { state.stage = 1; toast('Parcel secured · head to Solano Plaza'); event('pickup'); }
      else completeMission();
    } else if (i === 1) {
      if (state.stage === 0) {
        if (livingEnemies() === 0) { state.stage = 1; toast('Van keys taken · drive to Puerto Alto'); event('pickup'); }
      } else {
        const car = state.cars.find((c) => c.id === state.player.carId);
        if (car && car.kind === 'van') completeMission();
        else toast('You need the van');
      }
    } else if (i === 2) {
      const r = runner();
      if (r) r.kind = 'down';
      completeMission();
    } else if (i === 3 && livingEnemies() === 0) {
      completeMission();
    }
  }

  function hurtPlayer(amount) {
    const absorbed = Math.min(state.armor, amount * 0.6);
    state.armor -= absorbed;
    state.health = Math.max(0, state.health - (amount - absorbed));
    state.player.health = state.health;
    state.player.armor = state.armor;
    if (state.health <= 0) {
      state.health = 100; state.player.health = 100;
      state.player.x = spawn.x; state.player.z = spawn.z;
      state.money = Math.max(0, state.money - 200);
      setWanted(0, 'busted');
      toast('Busted · $200 fine');
    }
  }

  function damageEnemy(enemy, amount) {
    enemy.health -= amount;
    enemy.hit = 0.25;
    event('hit');
    if (enemy.health <= 0) {
      enemy.state = 'down';
      event('enemyDown', { x: enemy.x, z: enemy.z });
      state.pickups.push({ id: nextId++, kind: 'money', x: enemy.x, z: enemy.z, amount: enemy.money });
    }
  }

  function fire(aim) {
    if (state.ammo <= 0) { event('dry'); return; }
    const p = state.player;
    const angle = typeof aim === 'number'
      ? aim
      : aim && typeof aim === 'object'
        ? Math.atan2(aim.z - p.z, aim.x - p.x)
        : p.angle;
    p.angle = angle;
    state.ammo--; p.ammo = state.ammo;
    event('shoot');
    const dx = Math.cos(angle), dz = Math.sin(angle);
    let best = null, bestProj = Infinity;
    const targets = state.enemies.filter((e) => e.state !== 'down')
      .concat(state.peds.filter((q) => q.kind !== 'down' && !q.runner));
    for (const target of targets) {
      const ox = target.x - p.x, oz = target.z - p.z;
      const proj = ox * dx + oz * dz;
      const perp = Math.abs(ox * dz - oz * dx);
      if (proj > 0 && proj < 145 && perp < 3.4 && proj < bestProj) { best = target; bestProj = proj; }
    }
    if (best) {
      if (best.kind === 'gangster') damageEnemy(best, 45);
      else { best.kind = 'down'; event('hit'); }
      event('impact', { x: best.x, z: best.z });
    }
  }

  function melee() {
    const p = state.player;
    event('melee');
    let best = null, bestD = 8;
    for (const e of state.enemies.concat(state.peds)) {
      if (e.state === 'down' || e.kind === 'down') continue;
      const d = distance(p, e);
      if (d < bestD) { best = e; bestD = d; }
    }
    if (best && best.kind === 'gangster') damageEnemy(best, 40);
    else if (best) { best.kind = 'down'; event('hit'); }
  }

  function tryEnter() {
    const p = state.player;
    if (!p.onFoot) {
      const car = state.cars.find((c) => c.id === p.carId);
      p.onFoot = true; p.carId = null; p.speed = 0;
      if (car) { p.x = car.x + 6; p.z = car.z; resolve(p, 1.6); }
      event('exit');
      return;
    }
    let best = null, bestD = 7.5;
    for (const car of state.cars) {
      if (car.exploded) continue;
      const d = distance(p, car);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (best) {
      p.onFoot = false; p.carId = best.id; p.angle = best.angle;
      p.x = best.x; p.z = best.z;
      event('enter', { kind: best.kind });
    }
  }

  function explode(car) {
    car.exploded = true;
    state.effects.push({ type: 'explosion', x: car.x, z: car.z, t: 0 });
    event('explosion', { x: car.x, z: car.z });
    if (state.player.carId === car.id) {
      state.player.onFoot = true; state.player.carId = null;
      hurtPlayer(24);
    }
  }

  function setWanted(level, reason) {
    state.wanted = clamp(level, 0, 5);
    const target = state.wanted === 0 ? 0 : state.wanted + 1;
    while (state.police.length > target) state.police.pop();
    while (state.police.length < target) {
      const a = random.range(0, Math.PI * 2);
      state.police.push({
        id: nextId++, x: state.player.x + Math.cos(a) * 120, z: state.player.z + Math.sin(a) * 120,
        angle: a + Math.PI, speed: 0, health: 100, cooldown: random.range(0.5, 2),
      });
    }
    event('wanted', { level: state.wanted, reason });
  }
  const addWanted = (n, reason) => setWanted(state.wanted + n, reason);

  function movePlayer(dt, input) {
    const p = state.player;
    if (p.onFoot) {
      const mag = Math.hypot(input.x, input.z) || 1;
      const speed = (input.sprint ? 11.5 : 7.2) * Math.min(1, mag);
      p.x += (input.x / mag) * speed * dt;
      p.z += (input.z / mag) * speed * dt;
      resolve(p, 1.7);
      p.speed = mag > 0.01 ? speed : 0;
      p.health = state.health; p.armor = state.armor; p.ammo = state.ammo;
    } else {
      const car = state.cars.find((c) => c.id === p.carId);
      if (!car || car.exploded) { p.onFoot = true; p.carId = null; return; }
      car.speed = clamp(car.speed + input.z * 30 * dt - car.speed * 0.35 * dt, -14, 58);
      if (input.handbrake) car.speed *= 0.93;
      car.angle += input.x * (car.speed / 16) * dt * 1.7 * (car.speed < 0 ? -1 : 1);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.z += Math.sin(car.angle) * car.speed * dt;
      if (resolve(car, 4.4)) {
        car.health -= Math.abs(car.speed) * 0.9;
        car.speed *= -0.22;
        event('crash');
        if (car.health <= 0) explode(car);
      }
      if (Math.abs(input.z) > 0.01) { p.x = car.x; p.z = car.z; }
      p.angle = car.angle; p.speed = car.speed;
      p.health = state.health; p.armor = state.armor; p.ammo = state.ammo;
    }
  }

  function updateCars(dt) {
    for (const car of state.cars) {
      if (car.exploded || car.parked || car.id === state.player.carId) continue;
      const step = car.speed * car.dir * dt;
      if (car.axis === 'x') {
        car.x += step;
        if (car.x > half + 60) car.x = -half - 60;
        if (car.x < -half - 60) car.x = half + 60;
      } else {
        car.z += step;
        if (car.z > half + 60) car.z = -half - 60;
        if (car.z < -half - 60) car.z = half + 60;
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      if (ped.kind === 'down') continue;
      if (ped.runner) {
        const p = state.player;
        ped.angle = Math.atan2(p.z - ped.z, p.x - ped.x) + Math.PI;
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.z += Math.sin(ped.angle) * ped.speed * dt;
      } else {
        const step = ped.speed * ped.dir * dt;
        if (ped.axis === 'x') { ped.x += step; if (Math.abs(ped.x) > half - 8) ped.dir *= -1; }
        else { ped.z += step; if (Math.abs(ped.z) > half - 8) ped.dir *= -1; }
      }
      ped.phase += dt * 7;
    }
  }

  function updatePolice(dt) {
    for (const cop of state.police) {
      const p = state.player;
      const dx = p.x - cop.x, dz = p.z - cop.z;
      const d = Math.hypot(dx, dz) || 1;
      cop.angle = Math.atan2(dz, dx);
      cop.speed = Math.min(30, cop.speed + 26 * dt);
      cop.x += (dx / d) * cop.speed * dt;
      cop.z += (dz / d) * cop.speed * dt;
      cop.cooldown -= dt;
      if (d < 14 && cop.cooldown <= 0) {
        cop.cooldown = 1.1;
        hurtPlayer(7);
        event('ram');
      }
    }
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      e.cooldown -= dt;
      e.hit = Math.max(0, e.hit - dt);
      if (e.state === 'down') continue;
      const d = distance(e, p);
      if (d > 150) { e.state = 'idle'; continue; }
      e.state = d < 58 ? 'attack' : 'chase';
      e.angle = Math.atan2(p.z - e.z, p.x - e.x);
      if (e.state === 'chase' && d > 24) {
        e.x += Math.cos(e.angle) * 8 * dt;
        e.z += Math.sin(e.angle) * 8 * dt;
      } else if (e.state === 'attack' && e.cooldown <= 0) {
        e.cooldown = 1.4;
        hurtPlayer(6);
        event('enemyShot');
      }
    }
  }

  function updatePickups() {
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const p = state.pickups[i];
      if (distance(p, state.player) > 5.5) continue;
      if (p.kind === 'money') state.money += p.amount;
      if (p.kind === 'health') state.health = Math.min(100, state.health + 40);
      if (p.kind === 'armor') state.armor = Math.min(100, state.armor + 50);
      if (p.kind === 'ammo') state.ammo += 20;
      state.player.health = state.health;
      state.player.armor = state.armor;
      state.player.ammo = state.ammo;
      event('pickup', { kind: p.kind });
      state.pickups.splice(i, 1);
    }
  }

  function updateEffects(dt) {
    for (let i = state.effects.length - 1; i >= 0; i--) {
      state.effects[i].t += dt;
      if (state.effects[i].t > 1.3) state.effects.splice(i, 1);
    }
    if (state.toastT > 0) {
      state.toastT -= dt;
      if (state.toastT <= 0) state.toast = null;
    }
  }

  function updateHint() {
    const p = state.player;
    if (p.onFoot) {
      let nearCar = false;
      for (const c of state.cars) if (!c.exploded && distance(p, c) < 8) { nearCar = true; break; }
      state.hint = nearCar ? 'E enter or steal vehicle  ·  J melee  ·  Left click fire  ·  Hold right to aim'
        : 'WASD move  ·  Shift sprint  ·  F3 find objective  ·  R haze';
    } else {
      state.hint = 'WASD drive  ·  E exit  ·  F handbrake  ·  H lights  ·  F2 wanted';
    }
  }

  function step(dt, input = {}) {
    state.time += dt;
    checkMission();
    movePlayer(dt, input);
    updateCars(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateEnemies(dt);
    updatePickups();
    updateEffects(dt);
    updateHint();
  }

  function snapshot() {
    const p = state.player;
    return {
      money: state.money, wanted: state.wanted, missionIndex: state.missionIndex,
      stage: state.stage, won: state.won, time: state.time,
      health: state.health, armor: state.armor, ammo: state.ammo, rain: state.rain,
      player: { x: p.x, z: p.z, angle: p.angle, onFoot: p.onFoot, carId: p.carId },
    };
  }

  function restore(data) {
    if (!data) return;
    state.money = data.money ?? state.money;
    state.wanted = data.wanted ?? 0;
    state.missionIndex = data.missionIndex ?? 0;
    state.stage = data.stage ?? 0;
    state.won = Boolean(data.won);
    state.time = data.time ?? 0;
    state.health = data.health ?? 100;
    state.armor = data.armor ?? 0;
    state.ammo = data.ammo ?? 12;
    state.rain = Boolean(data.rain);
    Object.assign(state.player, data.player || {}, {
      health: state.health, armor: state.armor, ammo: state.ammo,
    });
    const target = state.wanted === 0 ? 0 : state.wanted + 1;
    while (state.police.length > target) state.police.pop();
    while (state.police.length < target) {
      state.police.push({ id: nextId++, x: state.player.x + 140, z: state.player.z, angle: Math.PI, speed: 0, health: 100, cooldown: 1 });
    }
  }

  function reset() {
    Object.assign(state, {
      missionIndex: 0, stage: 0, money: 250, wanted: 0, health: 100, armor: 0,
      ammo: 12, time: 0, won: false, toast: null, dialogue: null,
    });
    Object.assign(state.player, {
      x: spawn.x, z: spawn.z, angle: 0, onFoot: true, carId: null,
      health: 100, armor: 0, ammo: 12, speed: 0,
    });
    state.police.length = 0;
    state.pickups.length = 0;
    state.effects.length = 0;
    startNextMission();
  }

  startNextMission();
  return {
    state, step, fire, melee, tryEnter, objective, startNextMission,
    addWanted, snapshot, restore, reset, explode,
  };
}
