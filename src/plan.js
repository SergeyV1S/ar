import { bounds, corners, dimensions, wallFeature } from './geometry.js';
import { decimal } from './data.js';

const timber = ['#eee5d9', '#f0e8de', '#eae0d4', '#eee4d8', '#f3ebe1'];
const purple = '#7546e8';
const palette = { sofa: '#e4d7c4', chair: '#aeb698', table: '#c69a69', cabinet: '#ba9270', pouf: '#d3c2e3', other: '#bab0cc' };

export function canvasContext(canvas, fixedWidth, fixedHeight) {
  const { width, height } = fixedWidth && fixedHeight ? { width: fixedWidth, height: fixedHeight } : canvas.getBoundingClientRect();
  const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2.5);
  const pixelWidth = Math.round(width * pixelRatio), pixelHeight = Math.round(height * pixelRatio);
  if (!pixelWidth || !pixelHeight) return null;
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { c: context, width, height };
}

function line(c, points, color, thickness = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color;
  c.lineWidth = thickness;
  c.stroke();
}

function path(c, points) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
}

function fill(c, points, color, stroke = '') {
  path(c, points);
  c.fillStyle = color;
  c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
}

function shape(c, x, y, w, h, radius, color, stroke = '') {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
  c.fillStyle = color;
  c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = .85; c.stroke(); }
}

function oval(c, x, y, rx, ry, color, stroke = '') {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = .8; c.stroke(); }
}

function woodgrain(c, x, y, w, h, strength) {
  for (let i = 0; i < 7; i++) {
    const yy = y + h / 8 * (i + 1);
    c.beginPath();
    c.moveTo(x, yy);
    c.bezierCurveTo(x + w * .31, yy - h * .13, x + w * .68, yy + h * .12, x + w, yy - 1.6);
    c.strokeStyle = i % 2 ? `rgba(103,62,35,${strength})` : `rgba(255,255,255,${strength * 1.6})`;
    c.lineWidth = .55;
    c.stroke();
  }
}

function furniture(c, item, pos, to, scale) {
  const box = bounds(item, pos);
  const [centerX, centerY] = to([box.x + box.w / 2, box.y + box.d / 2]);
  const w = item.w * scale, h = item.d * scale;
  c.save();
  c.translate(centerX, centerY);
  c.rotate(pos.r * Math.PI / 180);
  c.translate(-w / 2, -h / 2);
  c.shadowColor = 'rgba(64,45,43,.28)';
  c.shadowBlur = 9;
  c.shadowOffsetY = 4;
  if (item.kind === 'sofa' || item.kind === 'chair') {
    const couch = item.kind === 'sofa';
    shape(c, 0, 0, w, h, h * .18, couch ? '#c7b8a6' : '#909a7e');
    c.shadowColor = 'transparent';
    shape(c, 1, 1, w - 2, h - 3, h * .15, couch ? '#d9cbb8' : '#a7b295', couch ? '#b9aa99' : '#829075');
    const inner = w * (couch ? .075 : .16);
    const count = couch ? 3 : 1;
    const seat = (w - inner * 2) / count;
    for (let i = 0; i < count; i++) {
      const x = inner + seat * i + 1;
      const gradient = c.createLinearGradient(0, h * .18, 0, h);
      gradient.addColorStop(0, couch ? '#e0d2c2' : '#b2bea0'); gradient.addColorStop(1, couch ? '#f0e5d5' : '#c0c9ad');
      shape(c, x, h * .34, seat - 2, h * .62, h * .1, gradient, couch ? '#cbbdaa' : '#9da88a');
    }
    shape(c, 1, 1, w - 2, h * .31, h * .11, couch ? '#e9dfcf' : '#b9c3a7', couch ? '#d1c3b0' : '#a0ab8e');
    shape(c, 1, h * .2, inner - .5, h * .76, h * .1, couch ? '#ebe0cf' : '#b5c0a2', couch ? '#d1c3b0' : '#a0ab8e');
    shape(c, w - inner, h * .2, inner - .5, h * .76, h * .1, couch ? '#ebe0cf' : '#b5c0a2', couch ? '#d1c3b0' : '#a0ab8e');
    if (couch) {
      [[w * .21, '#bba5ca', -.24], [w * .81, '#a2a98b', .34]].forEach(([x, color, rotation]) => {
        c.save(); c.translate(x, h * .43); c.rotate(rotation);
        c.shadowColor = '#64536938'; c.shadowBlur = 3; c.shadowOffsetY = 1;
        shape(c, -h * .20, -h * .17, h * .39, h * .38, h * .09, color);
        c.shadowColor = 'transparent';
        shape(c, -h * .16, -h * .14, h * .32, h * .29, h * .07, '#ffffff17', '#ffffff38');
        c.restore();
      });
    } else {
      shape(c, w * .29, h * .29, w * .42, h * .25, h * .09, '#d4d8bf', '#a4ae93');
    }
  } else if (item.kind === 'table' || item.kind === 'pouf') {
    const table = item.kind === 'table';
    oval(c, w / 2, h / 2, w / 2, h / 2, table ? '#ac7d52' : '#b4a2c6');
    c.shadowColor = 'transparent';
    const gradient = c.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, table ? '#e5bc8d' : '#efe4f6');
    gradient.addColorStop(1, table ? '#c89865' : '#cbb8dd');
    oval(c, w / 2, h / 2 - .75, w / 2 - .75, h / 2 - .9, gradient, table ? '#b3865f' : '#bba6cd');
    c.save(); c.clip();
    if (table) {
      woodgrain(c, 0, 0, w, h, .18);
      c.save(); c.translate(w * .42, h * .49); c.rotate(-.25);
      shape(c, -w * .13, -h * .16, w * .24, h * .32, 1.4, '#ece4d4', '#8e735c');
      shape(c, -w * .09, -h * .12, w * .15, h * .15, 1, '#a6a48d');
      c.restore();
      oval(c, w * .67, h * .61, w * .094, h * .094, '#f1ead8', '#a87e58');
      oval(c, w * .67, h * .61, w * .048, h * .048, '#7d5f49');
    } else {
      oval(c, w / 2, h / 2, w * .41, h * .41, '#ffffff15', '#fff7ff66');
      for (let i = 0; i < 39; i++) {
        oval(c, ((i * 23) % 37) / 36 * w, ((i * 13) % 43) / 42 * h, .54, .5, i % 2 ? '#ffffff51' : '#9f8eae44');
      }
    }
    c.restore();
  } else {
    shape(c, 0, 0, w, h, 3, item.kind === 'cabinet' ? '#ae8159' : '#ada0c3');
    c.shadowColor = 'transparent';
    shape(c, 1, 1, w - 2, h - 2, 2, item.kind === 'cabinet' ? '#d3a679' : '#d4c9e4', '#ad927b');
    if (item.kind === 'cabinet') {
      woodgrain(c, 0, 0, w, h, .17);
      shape(c, w * .15, h * .36, w * .70, h * .30, 1.6, '#4a4240', '#302e2c');
      shape(c, w * .17, h * .39, w * .66, h * .07, 1, '#69615b');
    }
  }
  c.restore();
  return { item, box, x: to([box.x, box.y])[0], y: to([box.x, box.y])[1], w: box.w * scale, h: box.d * scale };
}

function rug(c, room, to, scale, entries, variant) {
  if (variant !== 0 || !entries.some(({ item }) => item.kind === 'sofa')) return;
  const { w, d } = dimensions(room.points);
  const [x, y] = to([w * .16, d * .24]);
  const rw = w * .46 * scale, rh = d * .60 * scale;
  shape(c, x, y, rw, rh, 4, '#ded4e7', '#bfb0cd');
  for (let i = 1; i < rh - 3; i += 2.5) line(c, [[x + 2, y + i], [x + rw - 2, y + i]], i % 3 ? '#f3e9f271' : '#bdaec442', .7);
  shape(c, x + 5, y + 5, rw - 10, rh - 10, 3, '#fff5ff20', '#f7f0f8');
  for (const edge of [x, x + rw]) {
    for (let j = 4; j < rh - 3; j += 3) line(c, [[edge - 2.2, y + j], [edge + 2.2, y + j + .3]], '#d1c4dc', .8);
  }
}

function guide(c, x, y, w, h, room) {
  const dim = dimensions(room.points), color = '#b3acbf', ink = '#686377';
  line(c, [[x, y - 12], [x, y - 28]], color);
  line(c, [[x + w, y - 12], [x + w, y - 28]], color);
  line(c, [[x, y - 20], [x + w, y - 20]], color);
  line(c, [[x - 2.5, y - 22.5], [x + 2.5, y - 17.5]], color);
  line(c, [[x + w - 2.5, y - 22.5], [x + w + 2.5, y - 17.5]], color);
  c.font = '700 11px Manrope Variable, Arial';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const text = `${decimal(dim.w, 2)} м`;
  shape(c, x + w / 2 - 25, y - 28, 50, 15, 4, '#f7f6fa');
  c.fillStyle = ink; c.fillText(text, x + w / 2, y - 20);
  line(c, [[x - 9, y], [x - 28, y]], color);
  line(c, [[x - 9, y + h], [x - 28, y + h]], color);
  line(c, [[x - 21, y], [x - 21, y + h]], color);
  c.save(); c.translate(x - 21, y + h / 2); c.rotate(-Math.PI / 2);
  shape(c, -25, -7.5, 50, 15, 4, '#f7f6fa'); c.fillStyle = ink; c.fillText(`${decimal(dim.d, 2)} м`, 0, 0);
  c.restore();
}

function iso(c, width, height, room, entries, zoom, selected) {
  const { w, d } = dimensions(room.points);
  const scale = Math.min((width - 39) / ((w + d) * .82), (height - 30) / ((w + d) * .39 + 2.3)) * zoom;
  const baseX = width / 2 - (w - d) * .41 * scale;
  const baseY = height / 2 - (w + d) * .195 * scale + .48 * scale;
  const to = ([x, y], z = 0) => [baseX + (x - y) * .82 * scale, baseY + (x + y) * .39 * scale - z * scale];
  const floor = room.points.map(p => to(p));
  fill(c, floor.map(([x, y]) => [x, y + 7]), '#c4b1a9');
  fill(c, floor, '#ede0ce', '#a99889');
  c.save(); path(c, floor); c.clip();
  for (let y = .22; y < d; y += .22) line(c, [to([0, y]), to([w, y])], '#cab5a15e', .7);
  c.restore();
  room.points.forEach((p, i) => {
    const q = room.points[(i + 1) % room.points.length];
    if (i > 0 && i < room.points.length - 1) {
      line(c, [to(p), to(q)], '#655b70', 2);
      return;
    }
    const wallHeight = 1.5;
    fill(c, [to(p), to(q), to(q, wallHeight), to(p, wallHeight)], i === 0 ? '#eae5f3' : '#ddd5eb', '#b2a7c2');
    room.openings.filter(o => o.wall === i && o.type === 'window').forEach(o => {
      const window = wallFeature(room.points, o);
      if (window) fill(c, [to(window.start, .55), to(window.end, .55), to(window.end, 1.25), to(window.start, 1.25)], '#dde9f7', '#a3b5cc');
    });
  });
  const targets = [];
  [...entries].sort((a, b) => a.box.x + a.box.y - b.box.x - b.box.y).forEach(({ item, box }) => {
    const base = corners(box);
    const color = palette[item.kind] ?? palette.other;
    const z = item.h;
    fill(c, [to(base[1]), to(base[2]), to(base[2], z), to(base[1], z)], color, '#7c6b68');
    fill(c, [to(base[2]), to(base[3]), to(base[3], z), to(base[2], z)], color, '#8e7e73');
    const front = [to(base[2]), to(base[3]), to(base[3], z), to(base[2], z)];
    fill(c, front, '#3930391c');
    const top = base.map(p => to(p, z));
    fill(c, top, color, selected === item.id ? purple : '#8e7d73'); fill(c, top, '#ffffff37');
    if (['sofa', 'chair'].includes(item.kind)) {
      const inset = { x: box.x + box.w * .14, y: box.y + box.d * .12, w: box.w * .72, d: box.d * .76 };
      fill(c, corners(inset).map(p => to(p, z + .01)), '#ffffff39', '#79726966');
    }
    targets.push({ item, polygon: [...top], front, box });
  });
  return { targets, scale, to };
}

export function drawPlan(canvas, project, items, positions, inspection, options = {}) {
  const screen = canvasContext(canvas, options.width, options.height);
  if (!screen) return null;
  const { c, width, height } = screen;
  const { room } = project, zoom = options.zoom || 1;
  c.clearRect(0, 0, width, height);
  const entries = items.flatMap(item => positions[item.id] ? [{ item, pos: positions[item.id], box: bounds(item, positions[item.id]) }] : []);
  if (options.view === '3d') return iso(c, width, height, room, entries, zoom, options.selected);
  const { w, d } = dimensions(room.points);
  const scale = Math.min((width - (width < 430 ? 81 : 143)) / w, (height - 95) / d) * zoom;
  const origin = [(width - w * scale) / 2 + (width < 430 ? 7 : 1), (height - d * scale) / 2 + 8];
  const to = ([x, y]) => [origin[0] + x * scale, origin[1] + y * scale];
  const floor = room.points.map(to);
  guide(c, ...origin, w * scale, d * scale, room);
  c.save();
  c.shadowColor = '#43344e38'; c.shadowBlur = 16; c.shadowOffsetY = 6;
  fill(c, floor, '#efe6da');
  c.restore();
  c.save(); path(c, floor); c.clip();
  const plank = Math.max(6, scale * .19);
  for (let i = 0; i <= d * scale / plank; i++) {
    const y = origin[1] + i * plank;
    for (let j = -1; j <= w / 1.15; j++) {
      const x = origin[0] + j * scale * 1.15 + (i % 3) * scale * .38;
      c.fillStyle = timber[((i * 3 + j * 2) % timber.length + timber.length) % timber.length];
      c.fillRect(x, y, scale * 1.15 + 1, plank + 1);
      line(c, [[x, y], [x + scale * 1.15, y], [x + scale * 1.15, y + plank]], '#c9ad934f', .55);
      if (i % 2 === 0) woodgrain(c, x + 2, y, scale * 1.15 - 4, plank, .055);
    }
  }
  rug(c, room, to, scale, entries, project.variant);
  const route = inspection.path.map(to);
  if (route.length) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    line(c, route, '#8fbe9e39', Math.max(11, project.passage * scale * .46));
    c.setLineDash([4, 5]); line(c, route, '#5b9e76a1', 1.25); c.setLineDash([]);
    const [x, y] = route.at(-1); oval(c, x, y, 3.1, 3.1, '#6ca681');
  }
  c.restore();
  const wall = Math.max(4, Math.min(7, scale * .072));
  c.lineJoin = 'round'; c.lineCap = 'square';
  path(c, floor); c.strokeStyle = '#61596d'; c.lineWidth = wall; c.stroke();
  path(c, floor); c.strokeStyle = '#81758a'; c.lineWidth = wall * .28; c.stroke();
  room.openings.forEach(opening => {
    const feature = wallFeature(room.points, opening);
    if (!feature) return;
    const a = to(feature.start), b = to(feature.end);
    if (opening.type === 'window') {
      line(c, [a, b], '#c6d9ed', wall + 1);
      const [ix, iy] = feature.inward;
      line(c, [[a[0] + ix * 2, a[1] + iy * 2], [b[0] + ix * 2, b[1] + iy * 2]], '#edf7fd', 1);
    } else if (opening.type === 'door') {
      line(c, [a, b], '#f7f6fa', wall + .7);
      const arc = feature.arc.map(to);
      fill(c, [to(feature.hinge), ...arc], '#bda9d42a');
      c.setLineDash([3, 2]); line(c, arc, '#9682aa', 1); c.setLineDash([]);
      line(c, [to(feature.hinge), arc.at(-1)], '#756783', 1.65);
      const [x, y] = to(feature.hinge); oval(c, x, y, 2.3, 2.3, '#746482');
    } else {
      const [x, y] = to(feature.middle), [ix, iy] = feature.inward;
      shape(c, x + ix * 7 - 4, y + iy * 7 - 3.5, 8, 7, 1.4, '#fff8ef', '#937b71');
      oval(c, x + ix * 7 - 1.5, y + iy * 7, .65, .65, '#605268');
      oval(c, x + ix * 7 + 1.5, y + iy * 7, .65, .65, '#605268');
    }
  });
  const targets = entries.map(({ item, pos }) => furniture(c, item, pos, to, scale));
  targets.forEach(({ item, x, y, w: width, h }) => {
    const warning = inspection.warnings.some(issue => issue.id === item.id || issue.other === item.id);
    if (options.selected === item.id || warning) {
      c.beginPath(); c.roundRect(x - 3, y - 3, width + 6, h + 6, 6);
      c.lineWidth = 1.7; c.strokeStyle = warning ? '#cb6653' : purple;
      c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    }
  });
  return { targets, scale, to };
}
