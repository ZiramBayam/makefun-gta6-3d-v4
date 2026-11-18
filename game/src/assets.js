// Procedural low-poly assets: every texture is painted on a canvas at runtime.
import { PALETTE, cssColor } from './config.js';

export function createAssets(THREE, random) {
  const T = THREE;
  const materials = {};
  const textures = {};

  const mat = (key, color, opts = {}) => {
    if (!materials[key]) materials[key] = new T.MeshLambertMaterial({ color, ...opts });
    return materials[key];
  };
  const basic = (key, color, opts = {}) => {
    if (!materials[key]) materials[key] = new T.MeshBasicMaterial({ color, ...opts });
    return materials[key];
  };
  const paint = (key, w, h, draw) => {
    if (textures[key]) return textures[key];
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 2;
    textures[key] = tex;
    return tex;
  };
  const fill = (g, color, x, y, w, h) => { g.fillStyle = cssColor(color); g.fillRect(x, y, w, h); };

  // Facade texture: a sunlit wall with a disciplined grid of windows and sills.
  const facade = (base, glass, rows, cols, key) => paint(key, 128, 256, (g, w, h) => {
    fill(g, base, 0, 0, w, h);
    fill(g, 0x000000, 0, 0, 3, h);
    g.globalAlpha = 0.12;
    for (let x = 0; x < w; x += 16) fill(g, 0x071a24, x, 0, 2, h);
    g.globalAlpha = 1;
    const m = 10;
    const cw = (w - m * 2) / cols;
    const ch = (h - m * 2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = m + c * cw + 2;
        const y = m + r * ch + 3;
        const ww = cw - 5;
        const wh = ch - 7;
        const shade = (r * 13 + c * 7) % 5;
        fill(g, glass, x, y, ww, wh);
        g.globalAlpha = 0.18 + shade * 0.05;
        fill(g, shade % 2 ? PALETTE.sunGold : PALETTE.glassTint, x, y, ww, wh * 0.42);
        g.globalAlpha = 1;
        fill(g, PALETTE.ivory, x - 1, y + wh, ww + 2, 2);
      }
    }
    fill(g, PALETTE.roof, 0, 0, w, 6);
  });

  // The whole street plan is one crisp overhead painting: sidewalks, roads, lots and water.
  const groundTexture = (city) => paint('ground', 2048, 2048, (g, W, H) => {
    const sx = W / city.width;
    const sz = H / city.depth;
    const px = (x) => (x + city.width / 2) * sx;
    const pz = (z) => (z + city.depth / 2) * sz;
    fill(g, PALETTE.sidewalk, 0, 0, W, H);
    for (const road of city.roads) {
      if (road.axis === 'z') {
        fill(g, PALETTE.asphalt, px(road.x - road.w / 2), pz(road.z - road.d / 2), road.w * sx, road.d * sz);
        g.fillStyle = cssColor(PALETTE.paving);
        for (let z = road.z - road.d / 2 + 10; z < road.z + road.d / 2; z += 34) g.fillRect(px(road.x) - 1, pz(z), 2, 14);
      } else {
        fill(g, PALETTE.asphalt, px(road.x - road.w / 2), pz(road.z - road.d / 2), road.w * sx, road.d * sz);
        g.fillStyle = cssColor(PALETTE.paving);
        for (let x = road.x - road.w / 2 + 10; x < road.x + road.w / 2; x += 34) g.fillRect(px(x), pz(road.z) - 1, 14, 2);
      }
    }
    for (const block of city.blocks) {
      const x = px(block.x - block.w / 2), y = pz(block.z - block.d / 2);
      const w = block.w * sx, h = block.d * sz;
      if (block.kind === 'park') {
        fill(g, PALETTE.leaf, x, y, w, h);
        g.fillStyle = cssColor(PALETTE.sunGold);
        for (let i = 0; i < 22; i++) {
          const tx = x + 8 + ((i * 47) % Math.max(1, Math.floor(w - 16)));
          const ty = y + 8 + ((i * 31) % Math.max(1, Math.floor(h - 16)));
          g.beginPath(); g.arc(tx, ty, 4 + (i % 3), 0, Math.PI * 2); g.fill();
        }
      } else if (block.kind === 'plaza') {
        fill(g, PALETTE.paving, x, y, w, h);
        g.strokeStyle = cssColor(PALETTE.terracotta); g.globalAlpha = 0.22; g.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          g.beginPath(); g.moveTo(x + (i / 8) * w, y); g.lineTo(x + (i / 8) * w, y + h); g.stroke();
          g.beginPath(); g.moveTo(x, y + (i / 8) * h); g.lineTo(x + w, y + (i / 8) * h); g.stroke();
        }
        g.globalAlpha = 1;
      } else if (block.kind === 'pier') {
        fill(g, 0xc49a6a, x, y, w, h);
      } else {
        fill(g, 0xd7c3a0, x, y, w, h);
        g.strokeStyle = cssColor(PALETTE.terracotta); g.globalAlpha = 0.35; g.lineWidth = 3;
        g.strokeRect(x + 2, y + 2, w - 4, h - 4); g.globalAlpha = 1;
      }
    }
    const hb = city.harbor;
    fill(g, PALETTE.water, px(hb.x - hb.w / 2), pz(hb.z - hb.d / 2), hb.w * sx, hb.d * sz);
    g.strokeStyle = cssColor(PALETTE.seaGlass); g.globalAlpha = 0.32; g.lineWidth = 3;
    for (let i = 0; i < 60; i++) {
      const yy = pz(hb.z - hb.d / 2) + 12 + (i * 37) % Math.max(1, hb.d * sz - 20);
      g.beginPath();
      for (let k = 0; k <= 12; k++) {
        const xx = px(hb.x - hb.w / 2) + k * (hb.w * sx / 12);
        if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy + Math.sin(k * 1.7 + i) * 4);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  });

  const waterTexture = paint('water', 256, 256, (g, w, h) => {
    fill(g, PALETTE.seaGlass, 0, 0, w, h);
    g.strokeStyle = cssColor(PALETTE.paving); g.globalAlpha = 0.28; g.lineWidth = 2;
    for (let y = 8; y < h; y += 22) {
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y + Math.sin(x * 0.09 + y) * 3);
      }
      g.stroke();
    }
  });
  waterTexture.wrapS = waterTexture.wrapT = T.RepeatWrapping;

  const makeGround = (city) => {
    const mesh = new T.Mesh(
      new T.PlaneGeometry(city.width, city.depth),
      new T.MeshLambertMaterial({ map: groundTexture(city) }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  };

  const buildingGeom = new T.BoxGeometry(1, 1, 1);
  const makeBuildings = (city) => {
    const group = new T.Group();
    const buckets = [
      { key: 'low', base: PALETTE.terracotta, glass: PALETTE.glassTint, rows: 3, cols: 5, items: [] },
      { key: 'mid', base: PALETTE.coral, glass: PALETTE.glassBlue, rows: 5, cols: 6, items: [] },
      { key: 'tower', base: PALETTE.glassBlue, glass: PALETTE.glassTint, rows: 11, cols: 8, items: [] },
      { key: 'civic', base: PALETTE.paving, glass: PALETTE.glassBlue, rows: 4, cols: 6, items: [] },
    ];
    for (const block of city.blocks) {
      if (block.kind !== 'building') continue;
      const tower = block.district === 'Glass Mile' && random.chance(0.7);
      const h = tower ? random.range(90, 152) : random.range(26, 88);
      const item = {
        ...block,
        h,
        bw: block.w * random.range(0.72, 0.94),
        bd: block.d * random.range(0.72, 0.94),
        tint: tower ? 0xeafaff : random.chance(0.5) ? 0xfff2dd : 0xf6d9c4,
      };
      const index = tower ? 2 : block.district === 'Old Customs House' ? 3 : h < 52 ? 0 : 1;
      buckets[index].items.push(item);
    }
    for (const bucket of buckets) {
      if (bucket.items.length === 0) continue;
      const material = new T.MeshLambertMaterial({
        map: facade(bucket.base, bucket.glass, bucket.rows, bucket.cols, `facade-${bucket.key}`),
      });
      const mesh = new T.InstancedMesh(buildingGeom, material, bucket.items.length);
      const dummy = new T.Object3D();
      bucket.items.forEach((b, i) => {
        dummy.position.set(b.x, b.h / 2, b.z);
        dummy.scale.set(b.bw, b.h, b.bd);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, new T.Color(b.tint));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  };

  const trunkGeo = new T.CylinderGeometry(0.45, 0.8, 12, 6);
  const frondGeo = new T.ConeGeometry(1.15, 7.2, 3);
  frondGeo.rotateZ(-Math.PI / 2);
  frondGeo.translate(3.6, 0, 0);
  const trunkMat = mat('trunk', 0x8a6344, { flatShading: true });
  const frondMat = mat('frond', PALETTE.leaf, { flatShading: true, side: T.DoubleSide });

  const palmSpots = (city) => {
    const spots = [];
    for (let i = 0; i <= 9; i++) {
      const bx = -city.width / 2 + i * 160;
      for (let k = 0; k < 18; k++) {
        const x = bx + (i % 2 ? -10 : 10) + random.range(-2, 2);
        const z = -city.depth / 2 + (k + 0.5) * (city.depth / 18) + random.range(-6, 6);
        const inHarbor = x > city.harbor.x - city.harbor.w / 2 - 6 && z > city.harbor.z - city.harbor.d / 2;
        if (!inHarbor) spots.push({ x, z, tilt: random.range(-0.08, 0.08) });
      }
    }
    return spots;
  };

  const makePalms = (city) => {
    const spots = palmSpots(city);
    const group = new T.Group();
    const trunks = new T.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const fronds = new T.InstancedMesh(frondGeo, frondMat, spots.length * 6);
    const dummy = new T.Object3D();
    spots.forEach((p, i) => {
      dummy.position.set(p.x, 6, p.z);
      dummy.rotation.set(p.tilt, 0, p.tilt * 0.5);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      for (let f = 0; f < 6; f++) {
        dummy.position.set(p.x, 12, p.z);
        dummy.rotation.set(random.range(-0.16, 0.16), f * Math.PI / 3 + i * 0.3, 0);
        dummy.scale.setScalar(random.range(0.85, 1.15));
        dummy.updateMatrix();
        fronds.setMatrixAt(i * 6 + f, dummy.matrix);
        fronds.setColorAt(i * 6 + f, new T.Color(random.chance(0.5) ? 0xffffff : 0xcfebc4));
      }
    });
    trunks.instanceMatrix.needsUpdate = true;
    fronds.instanceMatrix.needsUpdate = true;
    if (fronds.instanceColor) fronds.instanceColor.needsUpdate = true;
    trunks.castShadow = true; fronds.castShadow = true;
    group.add(trunks, fronds);
    return group;
  };

  const makeBuilding = (block, district) => {
    const h = block.district === 'Glass Mile' ? random.range(86, 140) : random.range(30, 84);
    const group = new T.Group();
    const wall = new T.Mesh(
      new T.BoxGeometry(block.w * 0.86, h, block.d * 0.86),
      new T.MeshLambertMaterial({
        map: facade(district === 'Glass Mile' ? PALETTE.glassBlue : PALETTE.terracotta,
          PALETTE.glassTint, h > 80 ? 9 : h > 52 ? 5 : 3, 6, `single-${Math.round(h / 10)}`),
      }),
    );
    wall.position.y = h / 2;
    wall.castShadow = true; wall.receiveShadow = true;
    const roof = new T.Mesh(new T.BoxGeometry(block.w * 0.9, 2.4, block.d * 0.9), mat('roof', PALETTE.roof));
    roof.position.y = h + 1.2;
    group.add(wall, roof);
    group.position.set(block.x, 0, block.z);
    return group;
  };

  const makeRoad = (road) => {
    const mesh = new T.Mesh(
      new T.BoxGeometry(road.w, 0.3, road.d),
      mat('road', PALETTE.asphalt),
    );
    mesh.position.set(road.x, 0.15, road.z);
    mesh.receiveShadow = true;
    return mesh;
  };

  const makePalm = (x, z) => {
    const group = new T.Group();
    const trunk = new T.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 6; trunk.castShadow = true;
    group.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new T.Mesh(frondGeo, frondMat);
      frond.position.y = 12;
      frond.rotation.y = f * Math.PI / 3;
      frond.castShadow = true;
      group.add(frond);
    }
    group.position.set(x, 0, z);
    return group;
  };

  const wheelGeo = new T.CylinderGeometry(1.05, 1.05, 0.85, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  const glassMat = mat('glass', PALETTE.glassTint);
  const lampMat = basic('lamp', 0xfff0c0);
  const tailMat = basic('tail', PALETTE.coral);

  const makeCar = (kind) => {
    const group = new T.Group();
    const isVan = kind === 'van';
    const len = isVan ? 12.4 : 10;
    const wid = isVan ? 5.6 : 5.2;
    const bodyColor = kind === 'taxi' ? 0xf5c542 : kind === 'police' ? 0xf2efe6
      : random.pick([PALETTE.coral, PALETTE.seaGlass, PALETTE.glassBlue, PALETTE.ivory, PALETTE.terracotta]);
    const body = new T.Mesh(
      new T.BoxGeometry(wid, isVan ? 2.9 : 1.9, len),
      mat(`body-${kind}-${bodyColor}`, bodyColor),
    );
    body.position.y = isVan ? 2.2 : 1.7;
    body.castShadow = true;
    const cabin = new T.Mesh(new T.BoxGeometry(wid - 0.7, isVan ? 1.8 : 1.5, isVan ? 6 : 5), glassMat);
    cabin.position.set(0, isVan ? 4.3 : 3.25, -0.4);
    cabin.castShadow = true;
    group.add(body, cabin);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wheel = new T.Mesh(wheelGeo, mat('tyre', 0x23303a));
      wheel.position.set(sx * (wid / 2 - 0.2), 1.05, sz * (len / 2 - 2.2));
      group.add(wheel);
    }
    for (const sx of [-1, 1]) {
      const lamp = new T.Mesh(new T.BoxGeometry(1.3, 0.55, 0.25), lampMat);
      lamp.position.set(sx * 1.5, 1.9, len / 2 + 0.05);
      const tail = new T.Mesh(new T.BoxGeometry(1.1, 0.5, 0.25), tailMat);
      tail.position.set(sx * 1.6, 1.9, -len / 2 - 0.05);
      group.add(lamp, tail);
    }
    if (kind === 'taxi') {
      const sign = new T.Mesh(new T.BoxGeometry(2.4, 0.8, 1.3), basic('taxiSign', PALETTE.sunGold));
      sign.position.set(0, 4.4, -0.4);
      group.add(sign);
    }
    if (kind === 'police') {
      const stripe = new T.Mesh(new T.BoxGeometry(wid + 0.05, 0.9, len * 0.6), mat('policeStripe', PALETTE.policeBlue));
      stripe.position.y = 1.5;
      const red = new T.Mesh(new T.BoxGeometry(1.5, 0.6, 1.1), basic('boltRed', PALETTE.coral));
      red.position.set(-1.1, 4.4, -0.6);
      const blue = new T.Mesh(new T.BoxGeometry(1.5, 0.6, 1.1), basic('boltBlue', 0x4fa8ff));
      blue.position.set(1.1, 4.4, -0.6);
      group.add(stripe, red, blue);
    }
    group.userData = { kind, body, lampMat, tailMat, len };
    return group;
  };

  const pedPalette = {
    civilian: [0xe7c39a, 0x9fbfa8, PALETTE.terracotta, PALETTE.glassBlue],
    runner: [PALETTE.coral],
    gangster: [PALETTE.deepShadow],
    cop: [PALETTE.policeBlue],
    named: [PALETTE.seaGlass, PALETTE.ivory],
  };
  const makePed = (kind) => {
    const color = random.pick(pedPalette[kind] || pedPalette.civilian);
    const group = new T.Group();
    const shirt = new T.Mesh(new T.BoxGeometry(1.7, 2.3, 1), mat(`shirt-${color}`, color));
    shirt.position.y = 2.7; shirt.castShadow = true;
    const head = new T.Mesh(new T.BoxGeometry(1.15, 1.15, 1.15), mat('skin', 0xcda07a));
    head.position.y = 4.35; head.castShadow = true;
    const legGeo = new T.BoxGeometry(0.6, 1.7, 0.7);
    const legMat = mat('trousers', kind === 'gangster' ? 0x16232d : 0x4a4f58);
    const legL = new T.Mesh(legGeo, legMat); legL.position.set(-0.45, 0.85, 0);
    const legR = new T.Mesh(legGeo, legMat); legR.position.set(0.45, 0.85, 0);
    const armGeo = new T.BoxGeometry(0.45, 1.7, 0.55);
    const armL = new T.Mesh(armGeo, shirt.material); armL.position.set(-1.05, 2.7, 0);
    const armR = new T.Mesh(armGeo, shirt.material); armR.position.set(1.05, 2.7, 0);
    group.add(shirt, head, legL, legR, armL, armR);
    group.userData = { legL, legR, armL, armR, kind };
    return group;
  };

  const markerMat = basic('markerBeam', PALETTE.sunGold, {
    transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false,
  });
  const markerCore = basic('markerCore', PALETTE.sunGold, {
    transparent: true, opacity: 0.5, depthWrite: false,
  });
  const makeMarker = () => {
    const group = new T.Group();
    const beam = new T.Mesh(new T.CylinderGeometry(2.4, 5, 86, 12, 1, true), markerMat);
    beam.position.y = 43;
    const core = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 86, 8), markerCore);
    core.position.y = 43;
    const ring = new T.Mesh(new T.RingGeometry(5, 7.4, 28), markerMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4;
    const gem = new T.Mesh(new T.OctahedronGeometry(2.6), markerCore);
    gem.position.y = 88;
    group.add(beam, core, ring, gem);
    group.userData = { gem, beam };
    return group;
  };

  const explodeGeo = new T.IcosahedronGeometry(1, 0);
  const makeExplosion = (x, z) => {
    const group = new T.Group();
    const colors = [PALETTE.sunGold, PALETTE.coral, PALETTE.terracotta, PALETTE.ivory];
    for (let i = 0; i < 12; i++) {
      const mesh = new T.Mesh(explodeGeo, basic(`boom-${i % 4}`, colors[i % 4], { transparent: true, opacity: 0.92, depthWrite: false }));
      const a = (i / 12) * Math.PI * 2;
      mesh.userData = {
        vx: Math.cos(a) * random.range(16, 34),
        vy: random.range(12, 30),
        vz: Math.sin(a) * random.range(16, 34),
      };
      mesh.scale.setScalar(random.range(1.1, 2.6));
      group.add(mesh);
    }
    group.position.set(x, 2, z);
    return group;
  };

  return {
    materials, textures, groundTexture, waterTexture,
    makeGround, makeBuildings, makePalms,
    makeBuilding, makeRoad, makePalm, makeCar, makePed, makeMarker, makeExplosion,
  };
}
