// Third-person sunlit renderer: instanced city, pooled actors, smooth chase camera.
import { BUTTON_IDS, VIEW } from './config.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createRenderer(canvas, city, assets) {
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({
    canvas, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const sky = new T.Color(0xe4e9e2);
  scene.background = sky;
  scene.fog = new T.FogExp2(0xe4e9e2, 0.00155);

  const camera = new T.PerspectiveCamera(62, VIEW.width / VIEW.height, 0.5, 3200);
  const hemi = new T.HemisphereLight(0xfff6e0, 0xb89b78, 1.18);
  const sun = new T.DirectionalLight(0xffdfae, 1.12);
  sun.position.set(-420, 520, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -430; sun.shadow.camera.right = 430;
  sun.shadow.camera.top = 430; sun.shadow.camera.bottom = -430;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 1500;
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);

  scene.add(assets.makeGround(city));
  scene.add(assets.makeBuildings(city));
  scene.add(assets.makePalms(city));

  const harbor = city.harbor;
  const water = new T.Mesh(
    new T.PlaneGeometry(harbor.w, harbor.d),
    new T.MeshBasicMaterial({ map: assets.waterTexture, transparent: true, opacity: 0.24, depthWrite: false }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(harbor.x, 0.7, harbor.z);
  scene.add(water);

  const marker = assets.makeMarker();
  marker.visible = false;
  scene.add(marker);

  const avatar = assets.makePed('named');
  scene.add(avatar);

  const pools = { cars: new Map(), peds: new Map(), enemies: new Map(), police: new Map() };
  let booms = [];
  let yaw = 0, pitch = 0.34, fov = 62, aimBlend = 0, cameraReady = false;

  const api = {
    buttons: [], objectiveScreen: null, cameraMode: 'follow', gl: renderer.getContext(),
  };

  function placeActor(group, item, isCar) {
    group.position.set(item.x, isCar ? 0 : 0, item.z);
    group.rotation.y = Math.PI / 2 - (item.angle || 0);
  }

  function syncPool(pool, list, make, isCar) {
    const seen = new Set();
    for (const item of list) {
      if (item.exploded || item.kind === 'down') continue;
      let group = pool.get(item.id);
      if (!group) { group = make(item); scene.add(group); pool.set(item.id, group); }
      placeActor(group, item, isCar);
      if (isCar) {
        group.scale.setScalar(item.exploded ? 0.7 : 1);
      } else if (group.userData.legL) {
        const swing = Math.sin(item.phase || 0) * 0.42;
        group.userData.legL.rotation.x = swing;
        group.userData.legR.rotation.x = -swing;
        group.userData.armL.rotation.x = -swing * 0.6;
        group.userData.armR.rotation.x = swing * 0.6;
        if (item.hit !== undefined) group.scale.setScalar(1 + item.hit * 0.6);
      }
      seen.add(item.id);
    }
    for (const [id, group] of pool) {
      if (!seen.has(id)) { scene.remove(group); pool.delete(id); }
    }
  }

  function syncActors(state, time) {
    syncPool(pools.cars, state.cars, (car) => assets.makeCar(car.kind), true);
    syncPool(pools.peds, state.peds, (ped) => assets.makePed(ped.kind), false);
    syncPool(pools.enemies, state.enemies, () => assets.makePed('gangster'), false);
    syncPool(pools.police, state.police, () => {
      const car = assets.makeCar('police');
      const red = new T.Mesh(new T.BoxGeometry(1.7, 0.8, 1.2),
        new T.MeshBasicMaterial({ color: 0xff4d4d }));
      const blue = new T.Mesh(new T.BoxGeometry(1.7, 0.8, 1.2),
        new T.MeshBasicMaterial({ color: 0x5aa8ff }));
      red.position.set(-1.1, 4.5, -0.6);
      blue.position.set(1.1, 4.5, -0.6);
      car.add(red, blue);
      car.userData.flash = [red, blue];
      return car;
    }, true);
    for (const car of pools.police.values()) {
      if (car.userData.flash) {
        const phase = Math.floor(time * 6) % 2;
        car.userData.flash[0].visible = phase === 0;
        car.userData.flash[1].visible = phase === 1;
      }
    }
    avatar.visible = state.player.onFoot;
    if (avatar.visible) {
      avatar.position.set(state.player.x, 0, state.player.z);
      avatar.rotation.y = Math.PI / 2 - state.player.angle;
      const swing = Math.sin(state.time * 9) * (state.player.speed > 0.5 ? 0.5 : 0.05);
      avatar.userData.legL.rotation.x = swing;
      avatar.userData.legR.rotation.x = -swing;
    }

    while (booms.length > state.effects.length) {
      scene.remove(booms.pop());
    }
    for (let i = 0; i < state.effects.length; i++) {
      const fx = state.effects[i];
      if (!booms[i]) { booms[i] = assets.makeExplosion(fx.x, fx.z); scene.add(booms[i]); }
      const group = booms[i];
      const t = fx.t;
      group.children.forEach((piece) => {
        const v = piece.userData;
        piece.position.set(v.vx * t, 2 + v.vy * t - 22 * t * t, v.vz * t);
        piece.rotation.x += 0.12; piece.rotation.y += 0.16;
        piece.scale.setScalar(Math.max(0.05, 1.8 - t * 1.3));
      });
      group.position.set(fx.x, 2, fx.z);
    }
  }

  function updateCamera(state, mouse) {
    const p = state.player;
    const driving = !p.onFoot;
    if (mouse) {
      yaw += (mouse.dx || 0) * 0.0029 * (1 - aimBlend * 0.62);
      pitch = clamp(pitch + (mouse.dy || 0) * 0.0023, 0.06, 0.72);
    }
    aimBlend += ((mouse && mouse.aim ? 1 : 0) - aimBlend) * 0.16;
    const dist = (driving ? 38 : 27) * (1 - aimBlend * 0.46);
    const height = driving ? 6.4 : 4.4;
    const tx = p.x, tz = p.z;
    const desired = new T.Vector3(
      tx - Math.cos(yaw) * Math.cos(pitch) * dist,
      height + Math.sin(pitch) * dist,
      tz - Math.sin(yaw) * Math.cos(pitch) * dist,
    );
    if (cameraReady) camera.position.lerp(desired, 0.17);
    else { camera.position.copy(desired); cameraReady = true; }
    camera.lookAt(tx, driving ? 2.6 : 3.4, tz);
    const targetFov = (driving ? 68 : 62) - aimBlend * 17;
    fov += (targetFov - fov) * 0.14;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    sun.position.set(p.x - 420, 520, p.z + 260);
    sun.target.position.set(p.x, 0, p.z);
    sun.target.updateMatrixWorld();
  }

  function draw(state, screen, extras = {}) {
    syncActors(state, state.time);
    const goal = window.CBObjective;
    marker.visible = Boolean(goal && screen === 'play');
    if (marker.visible) {
      marker.position.set(goal.x, 0, goal.z);
      marker.userData.gem.rotation.y += 0.03;
      marker.userData.gem.position.y = 88 + Math.sin(state.time * 2.5) * 2.5;
    }
    updateCamera(state, extras.mouse);
    scene.fog.density = state.rain ? 0.0033 : 0.00155;
    scene.background.set(state.rain ? 0xcbd9d6 : 0xe4e9e2);
    scene.fog.color.copy(scene.background);
    assets.waterTexture.offset.x += 0.00035;
    assets.waterTexture.offset.y += 0.00018;
    renderer.render(scene, camera);
    api.buttons = screen === 'play' ? [] : BUTTON_IDS;
    api.objectiveScreen = goal ? worldToScreen(goal.x, goal.z) : null;
  }

  function worldToScreen(x, z) {
    const v = new T.Vector3(x, 3.5, z).project(camera);
    let sx = (v.x * 0.5 + 0.5) * VIEW.width;
    let sy = (-v.y * 0.5 + 0.5) * VIEW.height;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) { sx = VIEW.width / 2; sy = VIEW.height / 2; }
    const behind = v.z > 1 || v.z < -1;
    if (behind) {
      sx = v.x >= 0 ? VIEW.width : 0;
      sy = VIEW.height / 2;
    }
    return {
      x: clamp(sx, 0, VIEW.width), y: clamp(sy, 0, VIEW.height), behind,
    };
  }

  function screenToLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / (rect.width || 1)) * VIEW.width,
      y: ((clientY - rect.top) / (rect.height || 1)) * VIEW.height,
    };
  }

  function faceObjective(x, z, player) {
    yaw = Math.atan2(z - player.z, x - player.x);
    pitch = 0.3;
    cameraReady = false;
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth || VIEW.width;
    const h = canvas.clientHeight || window.innerHeight || VIEW.height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  resize();
  return { draw, resize, faceObjective, api, camera, worldToScreen, screenToLogical, scene, renderer };
}
