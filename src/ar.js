import { bounds, clamp, dimensions, distance, normalize, round, validPolygon } from './geometry.js';
import { newId } from './data.js';

export const arHelp = 'Для AR откройте сайт по HTTPS в Chrome на Android с поддержкой ARCore.';

export async function supportsAR() {
  try { return Boolean(globalThis.isSecureContext && navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); }
  catch { return false; }
}

const colors = { sofa: '#d7c6af', chair: '#a6b18e', table: '#c89567', cabinet: '#bf9873', pouf: '#d5c2e5', other: '#b6a5cf' };
const decode = color => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255);

function mesh() {
  const output = [];
  const tri = (a, b, c, color, shade = 1) => {
    for (const p of [a, b, c]) output.push(...p, ...color.map(component => component * shade));
  };
  const face = (a, b, c, d, color, shade) => { tri(a, b, c, color, shade); tri(a, c, d, color, shade); };
  const box = (x, y, z, width, height, depth, color) => {
    const a = [x, y, z], b = [x + width, y, z], c = [x + width, y, z + depth], d = [x, y, z + depth];
    const [e, f, g, h] = [a, b, c, d].map(([px, py, pz]) => [px, py + height, pz]);
    face(e, h, g, f, color, 1);
    face(a, b, f, e, color, .71); face(b, c, g, f, color, .83);
    face(c, d, h, g, color, .91); face(d, a, e, h, color, .77);
    face(a, d, c, b, color, .62);
  };
  const cylinder = (x, y, z, rx, rz, height, color, steps = 28) => {
    for (let i = 0; i < steps; i++) {
      const angle = i * 2 * Math.PI / steps, next = (i + 1) * 2 * Math.PI / steps;
      const point = (a, lift) => [x + rx * Math.cos(a), y + lift, z + rz * Math.sin(a)];
      tri([x, y + height, z], point(angle, height), point(next, height), color);
      face(point(angle, 0), point(next, 0), point(next, height), point(angle, height), color, .79 + .13 * Math.cos(angle + .65));
    }
  };
  return { output, tri, box, cylinder };
}

function furnitureMesh(items, positions) {
  const output = [];
  for (const item of items) {
    const pos = positions[item.id];
    if (!pos) continue;
    const m = mesh(), dye = decode(colors[item.kind] ?? colors.other);
    const { w, d, h } = item;
    if (item.kind === 'sofa' || item.kind === 'chair') {
      const arm = w * (item.kind === 'chair' ? .15 : .08);
      const seatCount = item.kind === 'sofa' ? 3 : 1;
      m.box(0, h * .10, 0, w, h * .30, d, dye);
      m.box(0, h * .40, 0, w, h * .60, d * .23, dye);
      m.box(0, h * .35, d * .12, arm, h * .38, d * .88, dye);
      m.box(w - arm, h * .35, d * .12, arm, h * .38, d * .88, dye);
      const seat = (w - arm * 2) / seatCount;
      for (let i = 0; i < seatCount; i++) m.box(arm + i * seat + .006, h * .40, d * .25, seat - .012, h * .13, d * .73, dye.map(c => Math.min(c * 1.09, 1)));
      for (const x of [w * .1, w * .9]) for (const z of [d * .14, d * .86]) m.cylinder(x, 0, z, .022, .022, h * .11, decode('#594232'), 8);
    } else if (item.kind === 'table') {
      m.cylinder(w / 2, h * .90, d / 2, w / 2, d / 2, h * .10, dye);
      for (let i = 0; i < 3; i++) {
        const angle = i * Math.PI * 2 / 3;
        m.cylinder(w / 2 + Math.cos(angle) * w * .33, 0, d / 2 + Math.sin(angle) * d * .33, .022, .022, h * .90, decode('#55453c'), 10);
      }
    } else if (item.kind === 'pouf') {
      m.cylinder(w / 2, .01, d / 2, w / 2, d / 2, h - .01, dye);
    } else if (item.kind === 'cabinet') {
      m.box(0, h * .12, 0, w, h * .88, d, dye);
      for (const x of [w * .08, w * .88]) for (const z of [d * .08, d * .87]) m.box(x, 0, z, w * .04, h * .12, d * .05, decode('#453b38'));
      m.box(w * .05, h * .22, d, w * .43, h * .57, .009, dye);
      m.box(w * .52, h * .22, d, w * .43, h * .57, .009, dye);
    } else {
      m.box(0, 0, 0, w, h, d, dye);
    }
    const box = bounds(item, pos), angle = pos.r * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let i = 0; i < m.output.length; i += 6) {
      const [x, y, z, r, g, b] = m.output.slice(i, i + 6);
      const dx = x - w / 2, dz = z - d / 2;
      output.push(box.x + box.w / 2 + dx * cos - dz * sin, y, box.y + box.d / 2 + dx * sin + dz * cos, r, g, b);
    }
  }
  return output;
}

function setupRenderer(gl) {
  const compile = (kind, source) => {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Не удалось подготовить 3D-графику.');
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `
    attribute vec3 vertex;
    attribute vec3 tint;
    uniform mat4 projection;
    uniform mat4 camera;
    uniform vec4 frame;
    uniform float sine;
    varying vec3 color;
    void main() {
      color = tint;
      vec3 point = vec3(frame.x + vertex.x * frame.w - vertex.z * sine,
        frame.y + vertex.y, frame.z + vertex.x * sine + vertex.z * frame.w);
      gl_Position = projection * camera * vec4(point, 1.0);
    }`));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Не удалось запустить 3D-графику.');
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const position = gl.getAttribLocation(program, 'vertex'), tint = gl.getAttribLocation(program, 'tint');
  gl.enableVertexAttribArray(position); gl.enableVertexAttribArray(tint);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(tint, 3, gl.FLOAT, false, 24, 12);
  const projection = gl.getUniformLocation(program, 'projection'), camera = gl.getUniformLocation(program, 'camera');
  const frame = gl.getUniformLocation(program, 'frame'), sine = gl.getUniformLocation(program, 'sine');
  gl.enable(gl.DEPTH_TEST);
  return {
    view(view) { gl.uniformMatrix4fv(projection, false, view.projectionMatrix); gl.uniformMatrix4fv(camera, false, view.transform.inverse.matrix); },
    draw(vertices, origin = [0, 0, 0], orientation = 0) {
      if (!vertices.length) return;
      gl.uniform4f(frame, ...origin, Math.cos(orientation)); gl.uniform1f(sine, Math.sin(orientation));
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
    },
  };
}

function mark(m, [x, y, z], color, radius = .035) {
  m.cylinder(x, y + .012, z, radius, radius, .01, color, 18);
}

function stroke(m, a, b, color, width = .013) {
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (length < .001) return;
  const dx = (b[2] - a[2]) * width / length, dz = (a[0] - b[0]) * width / length;
  const p = [a[0] + dx, a[1] + .018, a[2] + dz], q = [a[0] - dx, a[1] + .018, a[2] - dz];
  const r = [b[0] + dx, b[1] + .018, b[2] + dz], s = [b[0] - dx, b[1] + .018, b[2] - dz];
  m.tri(p, q, r, color); m.tri(r, q, s, color);
}

export function analyzeAR(corners, features) {
  if (corners.length < 3) return null;
  const [a, b] = corners;
  const angle = Math.atan2(b[2] - a[2], b[0] - a[0]), cos = Math.cos(angle), sin = Math.sin(angle);
  const toRoom = ([x, , z]) => [(x - a[0]) * cos + (z - a[2]) * sin, -(x - a[0]) * sin + (z - a[2]) * cos];
  const raw = corners.map(toRoom), points = normalize(raw);
  const extent = dimensions(points);
  if (extent.w < .7 || extent.d < .7 || extent.w > 35 || extent.d > 35 || !validPolygon(points)) return null;
  const nearest = (p, wall) => {
    const q = raw[wall], r = raw[(wall + 1) % raw.length], length = distance(q, r);
    const u = clamp(((p[0] - q[0]) * (r[0] - q[0]) + (p[1] - q[1]) * (r[1] - q[1])) / length, 0, length);
    return { u, error: distance(p, [q[0] + (r[0] - q[0]) * u / length, q[1] + (r[1] - q[1]) * u / length]), length };
  };
  const openings = [];
  let skipped = 0;
  for (const feature of features) {
    const targets = feature.points.map(toRoom);
    const choice = raw.map((_, wall) => {
      const projections = targets.map(p => nearest(p, wall));
      return { wall, projections, error: Math.max(...projections.map(p => p.error)) };
    }).sort((first, second) => first.error - second.error)[0];
    const line = choice.projections;
    const size = feature.type === 'socket' ? .08 : Math.abs(line[1].u - line[0].u);
    if (choice.error > .38 || size < (feature.type === 'socket' ? .07 : .28)) { skipped++; continue; }
    const width = Math.min(size, line[0].length);
    const offset = feature.type === 'socket' ? clamp(line[0].u - width / 2, 0, line[0].length - width) : Math.min(line[0].u, line[1].u);
    openings.push({ id: newId(), type: feature.type, wall: choice.wall, width: round(width), offset: round(offset), hinge: line[1]?.u < line[0].u ? 'end' : 'start' });
  }
  return { points, openings, skipped };
}

export async function startAR({ mode, overlay, items, positions, onState, onScan, onEnd }) {
  if (!globalThis.isSecureContext || !navigator.xr) throw new Error(arHelp);
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'dom-overlay'],
    domOverlay: { root: overlay },
  });
  const canvas = document.createElement('canvas');
  let hitSource;
  try {
    const gl = canvas.getContext('webgl', { xrCompatible: true, alpha: true, antialias: true });
    if (!gl) throw new Error('WebGL недоступен на этом устройстве.');
    await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl, { alpha: true }) });
    const [viewer, space] = await Promise.all([session.requestReferenceSpace('viewer'), session.requestReferenceSpace('local')]);
    hitSource = await session.requestHitTestSource({ space: viewer });
    const renderer = setupRenderer(gl);
    const model = furnitureMesh(items, positions);
    let hit = null, origin = null, orientation = null, ended = false, kind = 'corner';
    const corners = [], features = [], pending = [];
    const firstText = 'Наведите телефон на пол и медленно подвигайте им, пока не появится отметка.';
    const accent = decode('#9b67ff'), green = decode('#67d6a2'), yellow = decode('#fac65c');

    const help = (message = '') => {
      const text = mode === 'view'
        ? orientation !== null ? 'Мебель размещена. Обойдите её с камерой или переставьте модель.' : origin ? 'Отметьте вторую точку вдоль стены вправо от начала плана.' : 'Отметьте на полу угол, соответствующий левому верхнему углу плана.'
        : kind === 'corner' ? `Углов: ${corners.length}. Отмечайте углы по периметру, начиная с левого верхнего угла плана.`
          : kind === 'socket' ? 'Наведитесь на розетку или на пол прямо под ней.' : pending.length ? 'Отметьте второй край на той же стене.' : 'Отметьте первый край у стены. Для двери начните со стороны петель.';
      onState({ text: message || (!hit && !corners.length && !origin ? firstText : text), kind, ready: !!hit, count: corners.length, positioned: orientation !== null });
    };

    function collect() {
      if (!hit) { help('Поверхность пока не найдена. Медленно перемещайте камеру.'); return; }
      const point = [...hit];
      if (mode === 'view') {
        if (!origin || orientation !== null) { origin = point; orientation = null; }
        else if (Math.hypot(point[0] - origin[0], point[2] - origin[2]) < .30) {
          help('Выберите точку вдоль стены не ближе 30 см от начала.'); return;
        } else orientation = Math.atan2(point[2] - origin[2], point[0] - origin[0]);
      } else if (kind === 'corner') {
        if (corners.length >= 32) { help('Достигнут предел в 32 точки. Сохраните контур.'); return; }
        if (corners.some(p => Math.hypot(p[0] - point[0], p[2] - point[2]) < .08)) {
          help('Эта точка рядом с уже размеченным углом.'); return;
        }
        corners.push(point);
      } else {
        pending.push(point);
        if (kind === 'socket' || pending.length === 2) features.push({ type: kind, points: pending.splice(0) });
      }
      help();
    }

    const click = event => { event.preventDefault(); };
    overlay.addEventListener('beforexrselect', click);
    session.addEventListener('select', collect);
    session.addEventListener('end', () => {
      ended = true;
      hitSource.cancel();
      overlay.removeEventListener('beforexrselect', click);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      onEnd();
    }, { once: true });
    help();

    function frameLoop(time, frame) {
      if (ended) return;
      session.requestAnimationFrame(frameLoop);
      const pose = frame.getViewerPose(space), layer = session.renderState.baseLayer;
      const hitPose = frame.getHitTestResults(hitSource).map(result => result.getPose(space)).find(candidate => {
        if (!candidate) return false;
        if (mode === 'scan' && kind !== 'corner') return true;
        const floorY = (mode === 'view' ? origin : corners[0])?.[1];
        return Math.abs(candidate.transform.matrix[5]) > .85 && (floorY === undefined || Math.abs(candidate.transform.position.y - floorY) < .20);
      });
      const wasReady = !!hit;
      const p = hitPose?.transform.position;
      hit = p ? [p.x, p.y, p.z] : null;
      if (wasReady !== !!hit) help();
      if (!pose) return;
      const g = mesh();
      if (hit && orientation === null) mark(g, hit, green, .045);
      corners.forEach((point, i) => {
        mark(g, point, accent);
        if (i > 0) stroke(g, corners[i - 1], point, accent);
      });
      if (corners.length > 2) stroke(g, corners.at(-1), corners[0], decode('#a992df'), .007);
      for (const feature of features) {
        feature.points.forEach(point => mark(g, point, yellow, .034));
        if (feature.points.length > 1) stroke(g, ...feature.points, yellow);
      }
      pending.forEach(point => mark(g, point, yellow));
      if (origin) {
        mark(g, origin, accent);
        if (hit && orientation === null) stroke(g, origin, hit, accent);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const view of pose.views) {
        const viewport = layer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        renderer.view(view);
        renderer.draw(g.output);
        if (orientation !== null) renderer.draw(model, origin, orientation);
      }
    }
    session.requestAnimationFrame(frameLoop);
    return {
      collect,
      exit: () => session.end(),
      kind(next) { kind = next; pending.length = 0; help(); },
      undo() {
        if (mode === 'view') { origin = null; orientation = null; }
        else if (pending.length) pending.pop();
        else if (kind !== 'corner' && features.length) features.pop();
        else corners.pop();
        help();
      },
      async save() {
        if (pending.length) { help('Отметьте второй край проёма или отмените незавершённую точку.'); return; }
        const result = analyzeAR(corners, features);
        if (!result) { help('Нужны минимум три угла в порядке обхода без пересечения стен.'); return; }
        onScan(result);
        await session.end();
      },
    };
  } catch (error) {
    hitSource?.cancel();
    await session.end().catch(() => {});
    throw error;
  }
}
