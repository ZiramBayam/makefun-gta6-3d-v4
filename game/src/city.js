// Deterministic eight-district street grid, generated from CITY and DISTRICTS.
import { CITY, DISTRICTS } from './config.js';

const REGION_NAMES = [
  'Marisol Rows', 'Palma Vista', 'Puerto Alto',
  'Coral Causeway', 'Old Customs House', 'Solano Plaza',
  'Glass Mile', 'Seawall South', 'Seawall South',
];

export function createCity(random) {
  const { block, cols, rows, harborX, harborZ } = CITY;
  const width = cols * block;
  const depth = rows * block;
  const halfW = width / 2;
  const halfD = depth / 2;
  const roadW = 26;
  const inner = block - roadW;
  const cx = (col) => -halfW + (col + 0.5) * block;
  const cz = (row) => -halfD + (row + 0.5) * block;
  const bx = (i) => -halfW + i * block;
  const bz = (j) => -halfD + j * block;

  // The harbour occupies the south-east corner; harborZ is its northern reference.
  const harborStartRow = Math.min(rows - 4, harborZ + 3);
  const harborW = (cols - harborX) * block;
  const harborD = (rows - harborStartRow) * block;
  const harbor = {
    x: bx(harborX) + harborW / 2,
    z: halfD - harborD / 2,
    w: harborW,
    d: harborD,
  };

  // Road segments: every grid line is split per cell, giving a rich but regular network.
  const roads = [];
  for (let i = 0; i <= cols; i++) {
    for (let row = 0; row < rows; row++) {
      roads.push({ x: bx(i), z: cz(row), w: roadW, d: block, axis: 'z' });
    }
  }
  for (let j = 0; j <= rows; j++) {
    for (let col = 0; col < cols; col++) {
      roads.push({ x: cx(col), z: bz(j), w: block, d: roadW, axis: 'x' });
    }
  }

  const districtGroup = (col, row) => Math.floor(row / 3) * 3 + Math.floor(col / 3);
  const blocks = [];
  const parks = [];
  const districtCells = new Map();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col >= harborX && row >= harborStartRow) continue;
      const name = REGION_NAMES[districtGroup(col, row)] ?? 'Seawall South';
      let kind = 'building';
      const signature = col * 5 + row * 3;
      if (signature % 11 === 0 || random.chance(0.09)) kind = 'park';
      else if ((col * 2 + row * 7) % 19 === 0) kind = 'plaza';
      const cell = {
        x: cx(col), z: cz(row), w: inner, d: inner,
        district: name, kind, col, row,
      };
      blocks.push(cell);
      if (kind === 'park') parks.push({ x: cell.x, z: cell.z, w: inner, d: inner });
      if (!districtCells.has(name)) districtCells.set(name, []);
      districtCells.get(name).push(cell);
    }
  }

  // Guarantee a few green and civic breaks in the grid.
  let parkCount = parks.length;
  for (const cell of blocks) {
    if (parkCount >= 6) break;
    if (cell.kind === 'building' && (cell.col + cell.row * 2) % 7 === 0) {
      cell.kind = 'park';
      parks.push({ x: cell.x, z: cell.z, w: inner, d: inner });
      parkCount++;
    }
  }

  // Wooden piers reach into the harbour from its western edge.
  const piers = [];
  for (let k = 0; k < 4; k++) {
    const pier = {
      x: harbor.x - harbor.w / 2 + 72,
      z: harbor.z - harbor.d / 2 + (k + 0.5) * (harbor.d / 4),
      w: 132,
      d: 38,
      district: 'Seawall South',
      kind: 'pier',
    };
    piers.push(pier);
    blocks.push(pier);
  }

  const districts = DISTRICTS.map((entry) => {
    const cells = districtCells.get(entry.name);
    return {
      ...entry,
      x: cells ? cells.reduce((n, c) => n + c.x, 0) / cells.length : cx(7),
      z: cells ? cells.reduce((n, c) => n + c.z, 0) / cells.length : cz(3),
    };
  });

  const landmarks = [
    { name: 'Old Customs House', x: cx(4), z: cz(4), color: 0xc9a06a },
    { name: 'Solano Plaza', x: cx(7), z: cz(3), color: 0x8fb9c9 },
    { name: 'Glass Mile', x: cx(1), z: cz(7), color: 0x7fb8c9 },
    { name: 'Seawall South', x: cx(4), z: cz(7), color: 0x4fa8a0 },
  ];

  const spot = (bxIndex, bzIndex) => ({ x: bx(bxIndex) + 6, z: bz(bzIndex) + 6 });
  const objectiveSpots = {
    pickup: spot(2, 2),
    deliver: spot(7, 4),
    van: { x: piers[1].x, z: piers[1].z },
    garage: spot(7, 1),
    runner: spot(2, 4),
    plaza: spot(8, 3),
  };

  return {
    width, depth, districts, roads, blocks, harbor, parks, landmarks,
    spawn: spot(1, 1),
    objectiveSpots,
  };
}
