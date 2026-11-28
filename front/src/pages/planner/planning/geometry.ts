import type {
  Box,
  Inspection,
  Item,
  Opening,
  Point,
  Position,
  Positions,
  Room
} from "../types/index.ts";

export const maxOutlinePoints = 64;

export const variants = [
  { title: "Уютная гостиная", note: "Центр отдыха", style: "lounge" },
  { title: "Свободный центр", note: "Больше пространства", style: "space" },
  { title: "Зоны у стен", note: "Мебель по периметру", style: "walls" }
];

export const rect = (w: number, d: number) => [
  [0, 0],
  [w, 0],
  [w, d],
  [0, d]
];
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const round = (value: number) => Math.round(value * 100) / 100;

export const area = (points: Point[]) => {
  return (
    Math.abs(
      points.reduce((sum, [x, y], i) => {
        const [nx, ny] = points[(i + 1) % points.length];
        return sum + x * ny - y * nx;
      }, 0)
    ) / 2
  );
};

export const dimensions = (points: Point[]) => {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
};

export const normalizeWithOrigin = (points: Point[]) => {
  const left = Math.min(...points.map((p) => p[0]));
  const top = Math.min(...points.map((p) => p[1]));
  return {
    origin: [left, top],
    points: points.map(([x, y]) => [round(x - left), round(y - top)])
  };
};

export const normalize = (points: Point[]) => normalizeWithOrigin(points).points;

const segmentDistance = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return distance(p, [a[0] + dx * t, a[1] + dy * t]);
};

const crosses = (a: Point, b: Point, c: Point, d: Point) => {
  const turn = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return turn(a, b, c) * turn(a, b, d) < -1e-10 && turn(c, d, a) * turn(c, d, b) < -1e-10;
};

export const validPolygon = (points: Point[]) => {
  if (points.length < 3 || points.length > maxOutlinePoints || area(points) < 0.45) return false;
  return points.every((a, i) => {
    const b = points[(i + 1) % points.length];
    return (
      distance(a, b) >= 0.08 &&
      points.every((c, j) => {
        const next = (j + 1) % points.length;
        if (i === j || i === next || (i + 1) % points.length === j) return true;
        return !crosses(a, b, c, points[next]) && segmentDistance(a, c, points[next]) > 0.015;
      })
    );
  });
};

export const pointIn = (p: Point, poly: Point[]) => {
  let inside = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    if (segmentDistance(p, a, b) < 0.001) return true;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
};

export const bounds = (item: Pick<Item, "w" | "d">, pos: Position) => {
  const swap = pos.r % 180 !== 0;
  return { x: pos.x, y: pos.y, w: swap ? item.d : item.w, d: swap ? item.w : item.d };
};

export const corners = ({ x, y, w, d }: Box) => {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + d],
    [x, y + d]
  ];
};

export const fits = (box: Box, room: Point[]) => {
  const footprint = corners(box);
  if (!footprint.every((point) => pointIn(point, room))) return false;
  return footprint.every((a, i) =>
    room.every((b, j) => !crosses(a, footprint[(i + 1) % 4], b, room[(j + 1) % room.length]))
  );
};

const overlap = (a: Box, b: Box) => {
  return (
    a.x < b.x + b.w - 0.005 &&
    a.x + a.w > b.x + 0.005 &&
    a.y < b.y + b.d - 0.005 &&
    a.y + a.d > b.y + 0.005
  );
};

export const wallFeature = (room: Point[], opening: Opening) => {
  const a = room[opening.wall],
    b = room[(opening.wall + 1) % room.length];
  if (!a || !b) return null;
  const length = distance(a, b);
  const width = clamp(opening.width, 0, length);
  const offset = clamp(opening.offset, 0, length - width);
  const along = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  let inward = [-along[1], along[0]];
  const middle = [a[0] + along[0] * (offset + width / 2), a[1] + along[1] * (offset + width / 2)];
  if (!pointIn([middle[0] + inward[0] * 0.025, middle[1] + inward[1] * 0.025], room))
    inward = inward.map((v) => -v);
  const start = [a[0] + along[0] * offset, a[1] + along[1] * offset];
  const end = [start[0] + along[0] * width, start[1] + along[1] * width];
  const hinge = opening.hinge === "end" ? end : start;
  const direction = opening.hinge === "end" ? along.map((v) => -v) : along;
  const arc = Array.from({ length: 17 }, (_, i) => {
    const angle = ((i / 16) * Math.PI) / 2;
    return [
      hinge[0] + width * (direction[0] * Math.cos(angle) + inward[0] * Math.sin(angle)),
      hinge[1] + width * (direction[1] * Math.cos(angle) + inward[1] * Math.sin(angle))
    ];
  });
  return { start, end, hinge, inward, middle, arc };
};

const rectVsPolygon = (box: Box, poly: Point[]) => {
  const footprint = corners(box);
  const inBox = ([x, y]: Point) =>
    x > box.x + 0.006 &&
    x < box.x + box.w - 0.006 &&
    y > box.y + 0.006 &&
    y < box.y + box.d - 0.006;
  return (
    poly.some(inBox) ||
    footprint.some((p) => pointIn(p, poly)) ||
    footprint.some((a, i) =>
      poly.some((b, j) => crosses(a, footprint[(i + 1) % 4], b, poly[(j + 1) % poly.length]))
    )
  );
};

const clearance = (item: Item, pos: Position, box: Box) => {
  const depth = item.access || 0;
  if (!depth) return null;
  if (pos.r === 90) return { x: box.x - depth, y: box.y, w: depth, d: box.d };
  if (pos.r === 180) return { x: box.x, y: box.y - depth, w: box.w, d: depth };
  if (pos.r === 270) return { x: box.x + box.w, y: box.y, w: depth, d: box.d };
  return { x: box.x, y: box.y + box.d, w: box.w, d: depth };
};

const doorPolygons = (room: Room) => {
  return room.openings
    .filter((o) => o.type === "door")
    .map((o) => wallFeature(room.points, o))
    .filter((feature) => feature !== null)
    .map((f) => [f.hinge, ...f.arc]);
};

const passage = (room: Room, boxes: Box[], minimum: number, checkOnly = false) => {
  const door = room.openings.find((o) => o.type === "door");
  if (!door) return { path: [], state: "no-door" };
  if (door.width < minimum) return { path: [], state: "blocked", location: "в дверном проёме" };
  const f = wallFeature(room.points, door);
  if (!f) return { path: [], state: "no-door" };
  const { w, d } = dimensions(room.points);
  const step = Math.max(0.09, w / 114, d / 114);
  const radius = minimum / 2;
  const start = [
    f.middle[0] + f.inward[0] * (radius + step * 0.8),
    f.middle[1] + f.inward[1] * (radius + step * 0.8)
  ];
  const grid = Array.from(
    { length: Math.floor(d / step) + 1 },
    () => new Int8Array(Math.floor(w / step) + 1)
  );
  const free = ([x, y]: Point) =>
    pointIn([x, y], room.points) &&
    room.points.every(
      (a, i) =>
        segmentDistance([x, y], a, room.points[(i + 1) % room.points.length]) + 1e-12 >= radius
    ) &&
    boxes.every(
      ({ x: bx, y: by, w: bw, d: bd }) =>
        Math.hypot(x - clamp(x, bx, bx + bw), y - clamp(y, by, by + bd)) + 1e-12 >= radius
    );
  const cell = start.map((v) => Math.round(v / step));
  const candidateStarts = [
    cell,
    [cell[0] + 1, cell[1]],
    [cell[0] - 1, cell[1]],
    [cell[0], cell[1] + 1],
    [cell[0], cell[1] - 1]
  ];
  const first =
    free(start) &&
    candidateStarts.find(([x, y]) => grid[y]?.[x] === 0 && free([x * step, y * step]));
  if (!first) return { path: [], state: "blocked", location: "у входа в комнату" };
  const queue: { x: number; y: number; parent: (typeof queue)[number] | null }[] = [
    { x: first[0], y: first[1], parent: null }
  ];
  grid[first[1]][first[0]] = 1;
  let best = queue[0],
    bestScore = Infinity;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    const point = [current.x * step, current.y * step];
    const score = distance(point, [w * 0.52, d * 0.52]);
    if (checkOnly && score <= Math.max(0.55, minimum * 0.78)) return { path: [], state: "ok" };
    if (score < bestScore) {
      best = current;
      bestScore = score;
    }
    [
      [1, 0],
      [0, -1],
      [-1, 0],
      [0, 1]
    ].forEach(([dx, dy]) => {
      const x = current.x + dx,
        y = current.y + dy;
      if (grid[y]?.[x] !== 0) return;
      grid[y][x] = 1;
      if (free([x * step, y * step])) queue.push({ x, y, parent: current });
    });
  }
  if (bestScore > Math.max(0.55, minimum * 0.78))
    return {
      path: [],
      state: "blocked",
      location: `у границы доступной зоны (x = ${round(best.x * step)} м, y = ${round(best.y * step)} м)`
    };
  const path = [];
  for (let p: (typeof queue)[number] | null = best; p; p = p.parent)
    path.push([p.x * step, p.y * step]);
  path.push(start, f.middle);
  return { path: path.reverse(), state: "ok" };
};

export const inspect = (
  room: Room,
  items: Item[],
  positions: Positions,
  minimum = 0.8
): Inspection => {
  const warnings: Inspection["warnings"] = [];
  const doors = doorPolygons(room);
  const placed = items.flatMap((item) =>
    positions[item.id]
      ? [{ item, pos: positions[item.id], box: bounds(item, positions[item.id]) }]
      : []
  );
  items
    .filter((item) => !positions[item.id])
    .forEach((item) =>
      warnings.push({ id: item.id, message: `«${item.name}» не поместился при автоподборе.` })
    );
  placed.forEach(({ item, pos, box }, index) => {
    if (!fits(box, room.points))
      warnings.push({ id: item.id, message: `«${item.name}» выходит за контур комнаты.` });
    if (doors.some((poly) => rectVsPolygon(box, poly)))
      warnings.push({ id: item.id, message: `«${item.name}» мешает открыванию двери комнаты.` });
    placed.slice(index + 1).forEach((other) => {
      if (overlap(box, other.box))
        warnings.push({
          id: item.id,
          other: other.item.id,
          message: `«${item.name}» пересекается с «${other.item.name}».`
        });
    });
    const access = clearance(item, pos, box);
    if (
      access &&
      (!fits(access, room.points) ||
        doors.some((poly) => rectVsPolygon(access, poly)) ||
        placed.some((other) => other.item.id !== item.id && overlap(access, other.box)))
    ) {
      warnings.push({
        id: item.id,
        message: `Для открывания «${item.name}» нужно ещё ${Math.round((item.access ?? 0) * 100)} см свободного пространства перед фасадом.`
      });
    }
  });
  const route = passage(
    room,
    placed.map((entry) => entry.box),
    minimum
  );
  if (route.state === "blocked") {
    const blocker = placed.find(
      (entry) =>
        passage(
          room,
          placed.filter((other) => other !== entry).map((other) => other.box),
          minimum,
          true
        ).state === "ok"
    );
    const reason = blocker ? `мешает «${blocker.item.name}»` : route.location;
    warnings.push({
      id: blocker?.item.id,
      message: `Проход шириной ${Math.round(minimum * 100)} см от двери к центру прерван: ${reason}.`
    });
  }
  return { warnings, ...route };
};

const preferred: Record<string, number[]>[] = [
  {
    sofa: [0.09, 0.56, 270],
    chair: [0.74, 0.16, 0],
    table: [0.46, 0.5, 0],
    cabinet: [0.95, 0.46, 90],
    pouf: [0.63, 0.69, 0],
    other: [0.18, 0.15, 0]
  },
  {
    sofa: [0.5, 0.15, 0],
    chair: [0.16, 0.7, 270],
    table: [0.26, 0.27, 0],
    cabinet: [0.51, 0.9, 180],
    pouf: [0.15, 0.42, 0],
    other: [0.86, 0.46, 90]
  },
  {
    sofa: [0.87, 0.46, 90],
    chair: [0.17, 0.19, 0],
    table: [0.4, 0.25, 0],
    cabinet: [0.07, 0.5, 270],
    pouf: [0.7, 0.16, 0],
    other: [0.25, 0.79, 180]
  }
];

export const arrange = (room: Room, items: Item[], variant: number, minimum = 0.8) => {
  const { w, d } = dimensions(room.points);
  const doors = doorPolygons(room),
    positions: Positions = {};
  const occupied: { pos: Position; box: Box; access: Box | null }[] = [];
  const ordered = [...items].sort(
    (a, b) => Number(b.owned) - Number(a.owned) || b.w * b.d - a.w * a.d
  );
  ordered.forEach((item) => {
    const [fx, fy, rotation] = preferred[variant][item.kind] ?? preferred[variant].other;
    const candidates: ((typeof occupied)[number] & { score: number })[] = [];
    for (const r of [
      rotation,
      (rotation + 180) % 360,
      (rotation + 90) % 360,
      (rotation + 270) % 360
    ]) {
      const size = bounds(item, { x: 0, y: 0, r });
      if (size.w > w || size.d > d) continue;
      const px = clamp(fx * w - size.w / 2, 0.055, Math.max(0, w - size.w - 0.055));
      const py = clamp(fy * d - size.d / 2, 0.055, Math.max(0, d - size.d - 0.055));
      const step = Math.max(0.15, w / 36, d / 36);
      const test = (x: number, y: number) => {
        const score = Math.hypot(x - px, y - py) + (r === rotation ? 0 : 0.2);
        const pos = { x: round(x), y: round(y), r };
        const box = bounds(item, pos);
        const access = clearance(item, pos, box);
        if (
          !fits(box, room.points) ||
          doors.some((poly) => rectVsPolygon(box, poly)) ||
          occupied.some(
            (other) => overlap(box, other.box) || (other.access && overlap(box, other.access))
          )
        )
          return;
        if (
          access &&
          (!fits(access, room.points) ||
            doors.some((poly) => rectVsPolygon(access, poly)) ||
            occupied.some((other) => overlap(access, other.box)))
        )
          return;
        candidates.push({ pos, box, access, score });
      };
      test(px, py);
      test(w - size.w, py);
      test(w - size.w, d - size.d);
      for (let y = 0; y <= d - size.d; y += step) test(w - size.w, y);
      test(px, d - size.d);
      for (let x = 0; x <= w - size.w + 0.001; x += step) {
        test(x, d - size.d);
        for (let y = 0; y <= d - size.d + 0.001; y += step) test(x, y);
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    const boxes = occupied.map((entry) => entry.box);
    const existingRoute = passage(room, boxes, minimum, true);
    const placement =
      existingRoute.state === "ok"
        ? (candidates.find(
            ({ box }) => passage(room, [...boxes, box], minimum, true).state === "ok"
          ) ?? candidates[0])
        : candidates[0];
    if (placement) {
      positions[item.id] = placement.pos;
      occupied.push(placement);
    }
  });
  return positions;
};
