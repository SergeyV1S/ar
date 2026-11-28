const vertexShader = `
attribute vec3 vertex;
attribute vec4 tint;
uniform mat4 projection;
uniform mat4 camera;
uniform vec4 frame;
uniform float sine;
varying vec4 color;
varying float distance;
void main() {
  vec3 point = vec3(
    frame.x + vertex.x * frame.w - vertex.z * sine,
    frame.y + vertex.y,
    frame.z + vertex.x * sine + vertex.z * frame.w
  );
  vec4 eye = camera * vec4(point, 1.0);
  color = tint;
  distance = length(eye.xyz);
  gl_Position = projection * eye;
}`;

const fragmentShader = `
precision mediump float;
varying vec4 color;
varying float distance;
uniform float opacity;
void main() {
  float fade = clamp(1.0 - distance / 32.0, 0.52, 1.0);
  gl_FragColor = vec4(color.rgb * fade, color.a * opacity);
}`;

export type Mesh = { solid: Float32Array; glass: Float32Array };

const stride = 7 * 4;

export const createRenderer = (gl: WebGLRenderingContext) => {
  const compile = (kind: number, source: string) => {
    const shader = gl.createShader(kind);
    if (!shader) throw new Error("Не удалось создать шейдер.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? "";
      gl.deleteShader(shader);
      throw new Error(`Не удалось подготовить 3D-графику. ${log}`);
    }
    return shader;
  };
  const program = gl.createProgram();
  if (!program) throw new Error("Не удалось создать 3D-программу.");
  const vertex = compile(gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error("Не удалось запустить 3D-графику.");
  gl.useProgram(program);

  const position = gl.getAttribLocation(program, "vertex");
  const tint = gl.getAttribLocation(program, "tint");
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(tint);
  const projection = gl.getUniformLocation(program, "projection");
  const camera = gl.getUniformLocation(program, "camera");
  const frame = gl.getUniformLocation(program, "frame");
  const sine = gl.getUniformLocation(program, "sine");
  const opacity = gl.getUniformLocation(program, "opacity");
  gl.uniform1f(opacity, 1);
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Не удалось выделить буфер 3D-графики.");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, stride, 0);
  gl.vertexAttribPointer(tint, 4, gl.FLOAT, false, stride, 12);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0, 0, 0, 0);

  const upload = (data: Float32Array) => {
    if (!data.length) return;
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 7);
  };
  const translucent = (mesh: Mesh) => {
    if (!mesh.glass.length) return;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(opacity, 0.7);
    upload(mesh.glass);
    gl.uniform1f(opacity, 1);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  };
  const place = (origin: [number, number, number], angle: number) => {
    gl.uniform4f(frame, origin[0], origin[1], origin[2], Math.cos(angle));
    gl.uniform1f(sine, Math.sin(angle));
  };

  return {
    view(view: XRView) {
      gl.uniformMatrix4fv(projection, false, view.projectionMatrix);
      gl.uniformMatrix4fv(camera, false, view.transform.inverse.matrix);
    },
    clear(framebuffer: WebGLFramebuffer | null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    drawScene(mesh: Mesh) {
      place([0, 0, 0], 0);
      if (mesh.solid.length) upload(mesh.solid);
      translucent(mesh);
    },
    drawPlaced(
      mesh: Mesh,
      origin: [number, number, number],
      angle: number,
      pivot: [number, number] = [0, 0],
      turn = 0
    ) {
      const total = angle + turn;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const nextCos = Math.cos(total),
        nextSin = Math.sin(total);
      place(
        [
          origin[0] + pivot[0] * cos - pivot[1] * sin - (pivot[0] * nextCos - pivot[1] * nextSin),
          origin[1],
          origin[2] + pivot[0] * sin + pivot[1] * cos - (pivot[0] * nextSin + pivot[1] * nextCos)
        ],
        total
      );
      if (mesh.solid.length) upload(mesh.solid);
      translucent(mesh);
    }
  };
};

export type Renderer = ReturnType<typeof createRenderer>;
