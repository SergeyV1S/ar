export const variants = [
  { title: 'Уютная гостиная', note: 'Центр отдыха', style: 'lounge' },
  { title: 'Свободный центр', note: 'Больше пространства', style: 'space' },
  { title: 'Зоны у стен', note: 'Мебель по периметру', style: 'walls' },
];

export const rect = (w, d) => [[0, 0], [w, 0], [w, d], [0, d]];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const round = value => Math.round(value * 100) / 100;

export function area(points) {
  return Math.abs(points.reduce((sum, [x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return sum + x * ny - y * nx;
  }, 0)) / 2;
}

export function dimensions(points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
}

export function normalize(points) {
  const left = Math.min(...points.map(p => p[0]));
  const top = Math.min(...points.map(p => p[1]));
  return points.map(([x, y]) => [round(x - left), round(y - top)]);
}

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return distance(p, [a[0] + dx * t, a[1] + dy * t]);
}

function crosses(a, b, c, d) {
  const turn = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return turn(a, b, c) * turn(a, b, d) < -1e-10 && turn(c, d, a) * turn(c, d, b) < -1e-10;
}

export function validPolygon(points) {
  if (points.length < 3 || points.length > 32 || area(points) < 0.45) return false;
  return points.every((a, i) => {
    const b = points[(i + 1) % points.length];
    return distance(a, b) >= 0.08 && points.every((c, j) => {
      const next = (j + 1) % points.length;
      if (i === j || i === next || (i + 1) % points.length === j) return true;
      return !crosses(a, b, c, points[next]) && segmentDistance(a, c, points[next]) > 0.015;
    });
  });
}

export function pointIn(p, poly) {
  let inside = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (segmentDistance(p, a, b) < 0.001) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function bounds(item, pos) {
  const swap = pos.r % 180 !== 0;
  return { x: pos.x, y: pos.y, w: swap ? item.d : item.w, d: swap ? item.w : item.d };
}

export function corners({ x, y, w, d }) {
  return [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
}

function fits(box, room) {
  const footprint = corners(box);
  if (!footprint.every(point => pointIn(point, room))) return false;
  return footprint.every((a, i) => room.every((b, j) => !crosses(a, footprint[(i + 1) % 4], b, room[(j + 1) % room.length])));
}

function overlap(a, b) {
  return a.x < b.x + b.w - 0.005 && a.x + a.w > b.x + 0.005 && a.y < b.y + b.d - 0.005 && a.y + a.d > b.y + 0.005;
}

export function wallFeature(room, opening) {
  const a = room[opening.wall], b = room[(opening.wall + 1) % room.length];
  if (!a || !b) return null;
  const length = distance(a, b);
  const width = clamp(opening.width, 0, length);
  const offset = clamp(opening.offset, 0, length - width);
  const along = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  let inward = [-along[1], along[0]];
  const middle = [a[0] + along[0] * (offset + width / 2), a[1] + along[1] * (offset + width / 2)];
  if (!pointIn([middle[0] + inward[0] * 0.025, middle[1] + inward[1] * 0.025], room)) inward = inward.map(v => -v);
  const start = [a[0] + along[0] * offset, a[1] + along[1] * offset];
  const end = [start[0] + along[0] * width, start[1] + along[1] * width];
  const hinge = opening.hinge === 'end' ? end : start;
  const direction = opening.hinge === 'end' ? along.map(v => -v) : along;
  const arc = Array.from({ length: 17 }, (_, i) => {
    const angle = i / 16 * Math.PI / 2;
    return [hinge[0] + width * (direction[0] * Math.cos(angle) + inward[0] * Math.sin(angle)),
      hinge[1] + width * (direction[1] * Math.cos(angle) + inward[1] * Math.sin(angle))];
  });
  return { start, end, hinge, inward, middle, arc };
}

function rectVsPolygon(box, poly) {
  const footprint = corners(box);
  const inBox = ([x, y]) => x > box.x + 0.006 && x < box.x + box.w - 0.006 && y > box.y + 0.006 && y < box.y + box.d - 0.006;
  return poly.some(inBox) || footprint.some(p => pointIn(p, poly))
    || footprint.some((a, i) => poly.some((b, j) => crosses(a, footprint[(i + 1) % 4], b, poly[(j + 1) % poly.length])));
}

function clearance(item, pos, box) {
  const depth = item.access || 0;
  if (!depth) return null;
  if (pos.r === 90) return { x: box.x - depth, y: box.y, w: depth, d: box.d };
  if (pos.r === 180) return { x: box.x, y: box.y - depth, w: box.w, d: depth };
  if (pos.r === 270) return { x: box.x + box.w, y: box.y, w: depth, d: box.d };
  return { x: box.x, y: box.y + box.d, w: box.w, d: depth };
}

function doorPolygons(room) {
  return room.openings.filter(o => o.type === 'door').map(o => wallFeature(room.points, o)).filter(Boolean).map(f => [f.hinge, ...f.arc]);
}

function passage(room, boxes, minimum) {
  const door = room.openings.find(o => o.type === 'door');
  if (!door) return { path: [], state: 'no-door' };
  if (door.width + 0.001 < minimum) return { path: [], state: 'blocked' };
  const f = wallFeature(room.points, door);
  if (!f) return { path: [], state: 'no-door' };
  const { w, d } = dimensions(room.points);
  const step = Math.max(0.09, w / 114, d / 114);
  const radius = minimum / 2;
  const start = [f.middle[0] + f.inward[0] * (radius + step * 0.8), f.middle[1] + f.inward[1] * (radius + step * 0.8)];
  const grid = Array.from({ length: Math.floor(d / step) + 1 }, () => new Int8Array(Math.floor(w / step) + 1));
  const free = ([x, y]) => pointIn([x, y], room.points) && room.points.every((a, i) => segmentDistance([x, y], a, room.points[(i + 1) % room.points.length]) + 0.005 >= radius)
    && boxes.every(({ x: bx, y: by, w: bw, d: bd }) => Math.hypot((x - clamp(x, bx, bx + bw)), (y - clamp(y, by, by + bd))) + 0.005 >= radius);
  const cell = start.map(v => Math.round(v / step));
  const candidateStarts = [cell, [cell[0] + 1, cell[1]], [cell[0] - 1, cell[1]], [cell[0], cell[1] + 1], [cell[0], cell[1] - 1]];
  const first = free(start) && candidateStarts.find(([x, y]) => grid[y]?.[x] === 0 && free([x * step, y * step]));
  if (!first) return { path: [], state: 'blocked' };
  const queue = [{ x: first[0], y: first[1], parent: null }];
  grid[first[1]][first[0]] = 1;
  let best = queue[0], bestScore = Infinity;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    const point = [current.x * step, current.y * step];
    const score = distance(point, [w * 0.52, d * 0.52]);
    if (score < bestScore) { best = current; bestScore = score; }
    [[1, 0], [0, -1], [-1, 0], [0, 1]].forEach(([dx, dy]) => {
      const x = current.x + dx, y = current.y + dy;
      if (grid[y]?.[x] !== 0) return;
      grid[y][x] = 1;
      if (free([x * step, y * step])) queue.push({ x, y, parent: current });
    });
  }
  if (bestScore > Math.max(0.55, minimum * 0.78)) return { path: [], state: 'blocked' };
  const path = [];
  for (let p = best; p; p = p.parent) path.push([p.x * step, p.y * step]);
  path.push(start, f.middle);
  return { path: path.reverse(), state: 'ok' };
}

export function inspect(room, items, positions, minimum = 0.8) {
  const warnings = [];
  const doors = doorPolygons(room);
  const placed = items.flatMap(item => positions[item.id] ? [{ item, pos: positions[item.id], box: bounds(item, positions[item.id]) }] : []);
  items.filter(item => !positions[item.id]).forEach(item => warnings.push({ id: item.id, message: `«${item.name}» не поместился при автоподборе.` }));
  placed.forEach(({ item, pos, box }, index) => {
    if (!fits(box, room.points)) warnings.push({ id: item.id, message: `«${item.name}» выходит за контур комнаты.` });
    if (doors.some(poly => rectVsPolygon(box, poly))) warnings.push({ id: item.id, message: `«${item.name}» мешает открыванию двери комнаты.` });
    placed.slice(index + 1).forEach(other => {
      if (overlap(box, other.box)) warnings.push({ id: item.id, other: other.item.id, message: `«${item.name}» пересекается с «${other.item.name}».` });
    });
    const access = clearance(item, pos, box);
    if (access && (!fits(access, room.points) || doors.some(poly => rectVsPolygon(access, poly)) || placed.some(other => other.item.id !== item.id && overlap(access, other.box)))) {
      warnings.push({ id: item.id, message: `Для открывания «${item.name}» нужно ещё ${Math.round(item.access * 100)} см свободного пространства перед фасадом.` });
    }
  });
  const route = passage(room, placed.map(entry => entry.box), minimum);
  if (route.state === 'blocked') warnings.push({ message: `Проход от двери к центру комнаты шириной ${Math.round(minimum * 100)} см не найден.` });
  return { warnings, ...route };
}

const preferred = [
  { sofa: [.09, .56, 270], chair: [.74, .16, 0], table: [.46, .50, 0], cabinet: [.95, .46, 90], pouf: [.63, .69, 0], other: [.18, .15, 0] },
  { sofa: [.50, .15, 0], chair: [.16, .70, 270], table: [.26, .27, 0], cabinet: [.51, .90, 180], pouf: [.15, .42, 0], other: [.86, .46, 90] },
  { sofa: [.87, .46, 90], chair: [.17, .19, 0], table: [.40, .25, 0], cabinet: [.07, .50, 270], pouf: [.70, .16, 0], other: [.25, .79, 180] },
];

export function arrange(room, items, variant) {
  const { w, d } = dimensions(room.points);
  const doors = doorPolygons(room), positions = {};
  const occupied = [];
  const ordered = [...items].sort((a, b) => Number(b.owned) - Number(a.owned) || b.w * b.d - a.w * a.d);
  ordered.forEach(item => {
    const [fx, fy, rotation] = preferred[variant][item.kind] ?? preferred[variant].other;
    let best = null, bestScore = Infinity;
    for (const r of [rotation, (rotation + 180) % 360, (rotation + 90) % 360, (rotation + 270) % 360]) {
      const size = bounds(item, { x: 0, y: 0, r });
      if (size.w > w || size.d > d) continue;
      const px = clamp(fx * w - size.w / 2, 0.055, Math.max(0, w - size.w - 0.055));
      const py = clamp(fy * d - size.d / 2, 0.055, Math.max(0, d - size.d - 0.055));
      const step = Math.max(0.15, w / 36, d / 36);
      const test = (x, y) => {
        const score = Math.hypot(x - px, y - py) + (r === rotation ? 0 : 0.20);
        if (score >= bestScore) return;
        const pos = { x: round(x), y: round(y), r };
        const box = bounds(item, pos);
        const access = clearance(item, pos, box);
        if (!fits(box, room.points) || doors.some(poly => rectVsPolygon(box, poly)) || occupied.some(other => overlap(box, other.box) || (other.access && overlap(box, other.access)))) return;
        if (access && (!fits(access, room.points) || doors.some(poly => rectVsPolygon(access, poly)) || occupied.some(other => overlap(access, other.box)))) return;
        best = { pos, box, access };
        bestScore = score;
      };
      test(px, py);
      for (let x = 0; x <= w - size.w + 0.001; x += step) {
        for (let y = 0; y <= d - size.d + 0.001; y += step) test(x, y);
      }
    }
    if (best) { positions[item.id] = best.pos; occupied.push(best); }
  });
  return positions;
}
