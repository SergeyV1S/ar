import { newId } from "./data.ts";
import { bounds, clamp, dimensions, distance, normalize, round, validPolygon } from "./geometry.ts";
import type {
  ARMode,
  Item,
  Opening,
  Point,
  Positions,
  ScanFeature,
  ScanResult,
  XRState
} from "./types.ts";

export const arHelp = "Для AR откройте сайт по HTTPS в Chrome на Android с поддержкой ARCore.";

export const supportsAR = async () => {
  try {
    return Boolean(
      globalThis.isSecureContext &&
      navigator.xr &&
      (await navigator.xr.isSessionSupported("immersive-ar"))
    );
  } catch {
    return false;
  }
};

const colors: Record<string, string> = {
  sofa: "#d7c6af",
  chair: "#a6b18e",
  table: "#c89567",
  cabinet: "#bf9873",
  pouf: "#d5c2e5",
  other: "#b6a5cf"
};
const decode = (color: string) =>
  [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);

const mesh = () => {
  const output: number[] = [];
  const tri = (a: Point, b: Point, c: Point, color: Point, shade = 1) => {
    for (const p of [a, b, c]) output.push(...p, ...color.map((component) => component * shade));
  };
  const face = (a: Point, b: Point, c: Point, d: Point, color: Point, shade: number) => {
    tri(a, b, c, color, shade);
    tri(a, c, d, color, shade);
  };
  const box = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: Point
  ) => {
    const a = [x, y, z],
      b = [x + width, y, z],
      c = [x + width, y, z + depth],
      d = [x, y, z + depth];
    const [e, f, g, h] = [a, b, c, d].map(([px, py, pz]) => [px, py + height, pz]);
    face(e, h, g, f, color, 1);
    face(a, b, f, e, color, 0.71);
    face(b, c, g, f, color, 0.83);
    face(c, d, h, g, color, 0.91);
    face(d, a, e, h, color, 0.77);
    face(a, d, c, b, color, 0.62);
  };
  const cylinder = (
    x: number,
    y: number,
    z: number,
    rx: number,
    rz: number,
    height: number,
    color: Point,
    steps = 28
  ) => {
    for (let i = 0; i < steps; i++) {
      const angle = (i * 2 * Math.PI) / steps,
        next = ((i + 1) * 2 * Math.PI) / steps;
      const point = (a: number, lift: number) => [
        x + rx * Math.cos(a),
        y + lift,
        z + rz * Math.sin(a)
      ];
      tri([x, y + height, z], point(angle, height), point(next, height), color);
      face(
        point(angle, 0),
        point(next, 0),
        point(next, height),
        point(angle, height),
        color,
        0.79 + 0.13 * Math.cos(angle + 0.65)
      );
    }
  };
  return { output, tri, box, cylinder };
};

const furnitureMesh = (items: Item[], positions: Positions) => {
  const output: number[] = [];
  for (const item of items) {
    const pos = positions[item.id];
    if (!pos) continue;
    const m = mesh(),
      dye = decode(colors[item.kind] ?? colors.other);
    const { w, d, h } = item;
    if (item.kind === "sofa" || item.kind === "chair") {
      const arm = w * (item.kind === "chair" ? 0.15 : 0.08);
      const seatCount = item.kind === "sofa" ? 3 : 1;
      m.box(0, h * 0.1, 0, w, h * 0.3, d, dye);
      m.box(0, h * 0.4, 0, w, h * 0.6, d * 0.23, dye);
      m.box(0, h * 0.35, d * 0.12, arm, h * 0.38, d * 0.88, dye);
      m.box(w - arm, h * 0.35, d * 0.12, arm, h * 0.38, d * 0.88, dye);
      const seat = (w - arm * 2) / seatCount;
      for (let i = 0; i < seatCount; i++)
        m.box(
          arm + i * seat + 0.006,
          h * 0.4,
          d * 0.25,
          seat - 0.012,
          h * 0.13,
          d * 0.73,
          dye.map((c) => Math.min(c * 1.09, 1))
        );
      for (const x of [w * 0.1, w * 0.9])
        for (const z of [d * 0.14, d * 0.86])
          m.cylinder(x, 0, z, 0.022, 0.022, h * 0.11, decode("#594232"), 8);
    } else if (item.kind === "table") {
      m.cylinder(w / 2, h * 0.9, d / 2, w / 2, d / 2, h * 0.1, dye);
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        m.cylinder(
          w / 2 + Math.cos(angle) * w * 0.33,
          0,
          d / 2 + Math.sin(angle) * d * 0.33,
          0.022,
          0.022,
          h * 0.9,
          decode("#55453c"),
          10
        );
      }
    } else if (item.kind === "pouf") {
      m.cylinder(w / 2, 0.01, d / 2, w / 2, d / 2, h - 0.01, dye);
    } else if (item.kind === "cabinet") {
      m.box(0, h * 0.12, 0, w, h * 0.88, d, dye);
      for (const x of [w * 0.08, w * 0.88])
        for (const z of [d * 0.08, d * 0.87])
          m.box(x, 0, z, w * 0.04, h * 0.12, d * 0.05, decode("#453b38"));
      m.box(w * 0.05, h * 0.22, d, w * 0.43, h * 0.57, 0.009, dye);
      m.box(w * 0.52, h * 0.22, d, w * 0.43, h * 0.57, 0.009, dye);
    } else {
      m.box(0, 0, 0, w, h, d, dye);
    }
    const box = bounds(item, pos),
      angle = (pos.r * Math.PI) / 180;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    for (let i = 0; i < m.output.length; i += 6) {
      const [x, y, z, r, g, b] = m.output.slice(i, i + 6);
      const dx = x - w / 2,
        dz = z - d / 2;
      output.push(
        box.x + box.w / 2 + dx * cos - dz * sin,
        y,
        box.y + box.d / 2 + dx * sin + dz * cos,
        r,
        g,
        b
      );
    }
  }
  return output;
};

const setupRenderer = (gl: WebGLRenderingContext) => {
  const compile = (kind: number, source: string) => {
    const shader = gl.createShader(kind);
    if (!shader) throw new Error("Не удалось создать шейдер.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error("Не удалось подготовить 3D-графику.");
    return shader;
  };
  const program = gl.createProgram();
  if (!program) throw new Error("Не удалось создать 3D-программу.");
  gl.attachShader(
    program,
    compile(
      gl.VERTEX_SHADER,
      `
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
    }`
    )
  );
  gl.attachShader(
    program,
    compile(
      gl.FRAGMENT_SHADER,
      `
    precision mediump float;
    varying vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`
    )
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error("Не удалось запустить 3D-графику.");
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const position = gl.getAttribLocation(program, "vertex"),
    tint = gl.getAttribLocation(program, "tint");
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(tint);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(tint, 3, gl.FLOAT, false, 24, 12);
  const projection = gl.getUniformLocation(program, "projection"),
    camera = gl.getUniformLocation(program, "camera");
  const frame = gl.getUniformLocation(program, "frame"),
    sine = gl.getUniformLocation(program, "sine");
  gl.enable(gl.DEPTH_TEST);
  return {
    view(view: XRView) {
      gl.uniformMatrix4fv(projection, false, view.projectionMatrix);
      gl.uniformMatrix4fv(camera, false, view.transform.inverse.matrix);
    },
    draw(vertices: number[], origin: Point = [0, 0, 0], orientation = 0) {
      if (!vertices.length) return;
      gl.uniform4f(frame, origin[0], origin[1], origin[2], Math.cos(orientation));
      gl.uniform1f(sine, Math.sin(orientation));
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
    }
  };
};

const mark = (m: ReturnType<typeof mesh>, [x, y, z]: Point, color: Point, radius = 0.035) => {
  m.cylinder(x, y + 0.012, z, radius, radius, 0.01, color, 18);
};

const stroke = (m: ReturnType<typeof mesh>, a: Point, b: Point, color: Point, width = 0.013) => {
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (length < 0.001) return;
  const dx = ((b[2] - a[2]) * width) / length,
    dz = ((a[0] - b[0]) * width) / length;
  const p = [a[0] + dx, a[1] + 0.018, a[2] + dz],
    q = [a[0] - dx, a[1] + 0.018, a[2] - dz];
  const r = [b[0] + dx, b[1] + 0.018, b[2] + dz],
    s = [b[0] - dx, b[1] + 0.018, b[2] - dz];
  m.tri(p, q, r, color);
  m.tri(r, q, s, color);
};

export const analyzeAR = (corners: Point[], features: ScanFeature[]) => {
  if (corners.length < 3) return null;
  const [a, b] = corners;
  const angle = Math.atan2(b[2] - a[2], b[0] - a[0]),
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const toRoom = ([x, , z]: Point) => [
    (x - a[0]) * cos + (z - a[2]) * sin,
    -(x - a[0]) * sin + (z - a[2]) * cos
  ];
  const raw = corners.map(toRoom),
    points = normalize(raw);
  const extent = dimensions(points);
  if (extent.w < 0.7 || extent.d < 0.7 || extent.w > 35 || extent.d > 35 || !validPolygon(points))
    return null;
  const nearest = (p: Point, wall: number) => {
    const q = raw[wall],
      r = raw[(wall + 1) % raw.length],
      length = distance(q, r);
    const u = clamp(
      ((p[0] - q[0]) * (r[0] - q[0]) + (p[1] - q[1]) * (r[1] - q[1])) / length,
      0,
      length
    );
    return {
      u,
      error: distance(p, [
        q[0] + ((r[0] - q[0]) * u) / length,
        q[1] + ((r[1] - q[1]) * u) / length
      ]),
      length
    };
  };
  const openings: Opening[] = [];
  let skipped = 0;
  for (const feature of features) {
    const targets = feature.points.map(toRoom);
    const choice = raw
      .map((_, wall) => {
        const projections = targets.map((p) => nearest(p, wall));
        return { wall, projections, error: Math.max(...projections.map((p) => p.error)) };
      })
      .sort((first, second) => first.error - second.error)[0];
    const line = choice.projections;
    const size = feature.type === "socket" ? 0.08 : Math.abs(line[1].u - line[0].u);
    if (choice.error > 0.38 || size < (feature.type === "socket" ? 0.07 : 0.28)) {
      skipped++;
      continue;
    }
    const width = Math.min(size, line[0].length);
    const offset =
      feature.type === "socket"
        ? clamp(line[0].u - width / 2, 0, line[0].length - width)
        : Math.min(line[0].u, line[1].u);
    openings.push({
      id: newId(),
      type: feature.type,
      wall: choice.wall,
      width: round(width),
      offset: round(offset),
      hinge: line[1]?.u < line[0].u ? "end" : "start"
    });
  }
  return { points, openings, skipped };
};

export const startAR = async ({
  mode,
  overlay,
  items,
  positions,
  onState,
  onScan,
  onEnd
}: {
  mode: ARMode;
  overlay: HTMLDivElement;
  items: Item[];
  positions: Positions;
  onState: (state: XRState) => void;
  onScan: (result: ScanResult) => void;
  onEnd: () => void;
}) => {
  if (!globalThis.isSecureContext || !navigator.xr) throw new Error(arHelp);
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay"],
    domOverlay: { root: overlay }
  });
  const canvas = document.createElement("canvas");
  let hitSource: XRHitTestSource | undefined;
  try {
    const gl = canvas.getContext("webgl", { xrCompatible: true, alpha: true, antialias: true });
    if (!gl) throw new Error("WebGL недоступен на этом устройстве.");
    await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl, { alpha: true }) });
    const [viewer, space] = await Promise.all([
      session.requestReferenceSpace("viewer"),
      session.requestReferenceSpace("local")
    ]);
    const source = await session.requestHitTestSource?.({ space: viewer });
    if (!source) throw new Error(arHelp);
    hitSource = source;
    const renderer = setupRenderer(gl);
    const model = furnitureMesh(items, positions);
    let hit: Point | null = null,
      origin: Point | null = null,
      orientation: number | null = null,
      ended = false,
      kind = "corner";
    const corners: Point[] = [],
      features: ScanFeature[] = [],
      pending: Point[] = [];
    const firstText = "Наведите телефон на пол и медленно подвигайте им, пока не появится отметка.";
    const accent = decode("#9b67ff"),
      green = decode("#67d6a2"),
      yellow = decode("#fac65c");

    const help = (message = "") => {
      const text =
        mode === "view"
          ? orientation !== null
            ? "Мебель размещена. Обойдите её с камерой или переставьте модель."
            : origin
              ? "Отметьте вторую точку вдоль стены вправо от начала плана."
              : "Отметьте на полу угол, соответствующий левому верхнему углу плана."
          : kind === "corner"
            ? `Углов: ${corners.length}. Отмечайте углы по периметру, начиная с левого верхнего угла плана.`
            : kind === "socket"
              ? "Наведитесь на розетку или на пол прямо под ней."
              : pending.length
                ? "Отметьте второй край на той же стене."
                : "Отметьте первый край у стены. Для двери начните со стороны петель.";
      onState({
        text: message || (!hit && !corners.length && !origin ? firstText : text),
        kind,
        ready: !!hit,
        count: corners.length,
        positioned: orientation !== null
      });
    };

    const collect = () => {
      if (!hit) {
        help("Поверхность пока не найдена. Медленно перемещайте камеру.");
        return;
      }
      const point = [...hit];
      if (mode === "view") {
        if (!origin || orientation !== null) {
          origin = point;
          orientation = null;
        } else if (Math.hypot(point[0] - origin[0], point[2] - origin[2]) < 0.3) {
          help("Выберите точку вдоль стены не ближе 30 см от начала.");
          return;
        } else orientation = Math.atan2(point[2] - origin[2], point[0] - origin[0]);
      } else if (kind === "corner") {
        if (corners.length >= 32) {
          help("Достигнут предел в 32 точки. Сохраните контур.");
          return;
        }
        if (corners.some((p) => Math.hypot(p[0] - point[0], p[2] - point[2]) < 0.08)) {
          help("Эта точка рядом с уже размеченным углом.");
          return;
        }
        corners.push(point);
      } else {
        pending.push(point);
        if (kind === "socket" || pending.length === 2)
          features.push({ type: kind, points: pending.splice(0) });
      }
      help();
    };

    const click = (event: Event) => {
      event.preventDefault();
    };
    overlay.addEventListener("beforexrselect", click);
    session.addEventListener("select", collect);
    session.addEventListener(
      "end",
      () => {
        ended = true;
        hitSource?.cancel();
        overlay.removeEventListener("beforexrselect", click);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        onEnd();
      },
      { once: true }
    );
    help();

    const frameLoop = (_time: number, frame: XRFrame) => {
      if (ended) return;
      session.requestAnimationFrame(frameLoop);
      const pose = frame.getViewerPose(space),
        layer = session.renderState.baseLayer;
      const hitPose = frame
        .getHitTestResults(source)
        .map((result) => result.getPose(space))
        .find((candidate) => {
          if (!candidate) return false;
          if (mode === "scan" && kind !== "corner") return true;
          const floorY = (mode === "view" ? origin : corners[0])?.[1];
          return (
            Math.abs(candidate.transform.matrix[5]) > 0.85 &&
            (floorY === undefined || Math.abs(candidate.transform.position.y - floorY) < 0.2)
          );
        });
      const wasReady = !!hit;
      const p = hitPose?.transform.position;
      hit = p ? [p.x, p.y, p.z] : null;
      if (wasReady !== !!hit) help();
      if (!pose || !layer) return;
      const g = mesh();
      if (hit && orientation === null) mark(g, hit, green, 0.045);
      corners.forEach((point, i) => {
        mark(g, point, accent);
        if (i > 0) stroke(g, corners[i - 1], point, accent);
      });
      if (corners.length > 2)
        stroke(g, corners[corners.length - 1], corners[0], decode("#a992df"), 0.007);
      for (const feature of features) {
        feature.points.forEach((point) => mark(g, point, yellow, 0.034));
        if (feature.points.length > 1) stroke(g, feature.points[0], feature.points[1], yellow);
      }
      pending.forEach((point) => mark(g, point, yellow));
      if (origin) {
        mark(g, origin, accent);
        if (hit && orientation === null) stroke(g, origin, hit, accent);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const view of pose.views) {
        const viewport = layer.getViewport(view);
        if (!viewport) continue;
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        renderer.view(view);
        renderer.draw(g.output);
        if (orientation !== null) renderer.draw(model, origin ?? [0, 0, 0], orientation);
      }
    };
    session.requestAnimationFrame(frameLoop);
    return {
      collect,
      exit: () => session.end(),
      kind(next?: string) {
        kind = next ?? "corner";
        pending.length = 0;
        help();
      },
      undo() {
        if (mode === "view") {
          origin = null;
          orientation = null;
        } else if (pending.length) pending.pop();
        else if (kind !== "corner" && features.length) features.pop();
        else corners.pop();
        help();
      },
      async save() {
        if (pending.length) {
          help("Отметьте второй край проёма или отмените незавершённую точку.");
          return;
        }
        const result = analyzeAR(corners, features);
        if (!result) {
          help("Нужны минимум три угла в порядке обхода без пересечения стен.");
          return;
        }
        onScan(result);
        await session.end();
      }
    };
  } catch (error) {
    hitSource?.cancel();
    await session.end().catch(() => {});
    throw error;
  }
};

export type ARController = Awaited<ReturnType<typeof startAR>>;
