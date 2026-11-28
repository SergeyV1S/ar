import { MODEL_VERTEX_SIZE } from "./furnitureModels/index.ts";
import type { FurnitureInstance, FurnitureModel, ModelPart } from "./furnitureModels/index.ts";
import { createProgram } from "./webgl.ts";

const vertexShader = `
attribute vec3 vertex;
attribute vec3 normal;
attribute vec2 uv;
attribute vec4 tint;
uniform mat4 projection;
uniform mat4 camera;
uniform vec3 origin;
uniform vec2 roomTurn;
uniform vec4 placement;
uniform vec3 size;
varying vec3 worldNormal;
varying vec2 texcoord;
varying vec4 color;
vec2 rotate(vec2 point, vec2 turn) {
  return vec2(point.x * turn.x - point.y * turn.y, point.x * turn.y + point.y * turn.x);
}
void main() {
  vec3 point = (vertex - vec3(0.5, 0.0, 0.5)) * size;
  point.xz = rotate(rotate(point.xz, placement.zw) + placement.xy, roomTurn);
  worldNormal = normal / size;
  worldNormal.xz = rotate(rotate(worldNormal.xz, placement.zw), roomTurn);
  texcoord = uv;
  color = tint;
  gl_Position = projection * camera * vec4(origin + point, 1.0);
}
`;

const fragmentShader = `
precision mediump float;
uniform sampler2D baseColor;
uniform float cutoff;
uniform bool blended;
varying vec3 worldNormal;
varying vec2 texcoord;
varying vec4 color;
void main() {
  vec4 albedo = texture2D(baseColor, texcoord);
  float alpha = albedo.a * color.a;
  if (alpha < cutoff) discard;
  float light = 1.0;
  if (length(worldNormal) > 0.0) {
    vec3 n = normalize(gl_FrontFacing ? worldNormal : -worldNormal);
    light = 0.55 + 0.45 * max(dot(n, vec3(0.36, 0.87, 0.34)), 0.0);
  }
  vec3 linear = pow(albedo.rgb, vec3(2.2)) * color.rgb * light;
  gl_FragColor = vec4(pow(clamp(linear, 0.0, 1.0), vec3(1.0 / 2.2)), blended ? alpha : 1.0);
}
`;

export const createModelRenderer = (gl: WebGLRenderingContext) => {
  const program = createProgram(gl, vertexShader, fragmentShader);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const projection = uniform("projection");
  const camera = uniform("camera");
  const origin = uniform("origin");
  const roomTurn = uniform("roomTurn");
  const placement = uniform("placement");
  const size = uniform("size");
  const cutoff = uniform("cutoff");
  const blended = uniform("blended");
  const baseColor = uniform("baseColor");
  const attributes = [
    { location: gl.getAttribLocation(program, "vertex"), size: 3, offset: 0 },
    { location: gl.getAttribLocation(program, "normal"), size: 3, offset: 3 },
    { location: gl.getAttribLocation(program, "uv"), size: 2, offset: 6 },
    { location: gl.getAttribLocation(program, "tint"), size: 4, offset: 8 }
  ];
  const uintIndices = gl.getExtension("OES_element_index_uint");
  const textures: WebGLTexture[] = [];
  const buffers: WebGLBuffer[] = [];

  const createTexture = () => {
    const texture = gl.createTexture();
    if (!texture) throw new Error("Не удалось выделить текстуру мебели.");
    textures.push(texture);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    return texture;
  };

  gl.activeTexture(gl.TEXTURE0);
  const white = createTexture();
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255])
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  const uploadImage = ({ bitmap, mag, min, wrapS, wrapT }: FurnitureModel["images"][number]) => {
    const texture = createTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    if (min !== gl.NEAREST && min !== gl.LINEAR) gl.generateMipmap(gl.TEXTURE_2D);
    bitmap.close();
    return texture;
  };

  const upload = (target: number, data: BufferSource) => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Не удалось выделить буфер для модели мебели.");
    buffers.push(buffer);
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buffer;
  };

  const uploadPart = (part: ModelPart, images: WebGLTexture[]) => {
    const { vertices, indices, textureIndex, alphaMode, alphaCutoff, doubleSided } = part;
    const texture = textureIndex === null ? white : (images[textureIndex] ?? white);
    const material = { texture, alphaMode, alphaCutoff, doubleSided, count: indices.length };
    if (indices instanceof Uint32Array && !uintIndices) {
      const expanded = new Float32Array(indices.length * MODEL_VERTEX_SIZE);
      indices.forEach((index, i) => {
        const start = index * MODEL_VERTEX_SIZE;
        expanded.set(vertices.subarray(start, start + MODEL_VERTEX_SIZE), i * MODEL_VERTEX_SIZE);
      });
      return { ...material, vertexBuffer: upload(gl.ARRAY_BUFFER, expanded) };
    }
    return {
      ...material,
      vertexBuffer: upload(gl.ARRAY_BUFFER, vertices),
      indexBuffer: upload(gl.ELEMENT_ARRAY_BUFFER, indices),
      indexType: indices instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT
    };
  };

  type RenderPart = ReturnType<typeof uploadPart>;
  const cache = new WeakMap<FurnitureModel, RenderPart[]>();
  const partsFor = (model: FurnitureModel) => {
    const cached = cache.get(model);
    if (cached) return cached;
    const images = model.images.map(uploadImage);
    const parts = model.parts.map((part) => uploadPart(part, images));
    cache.set(model, parts);
    return parts;
  };

  const drawPart = (part: RenderPart) => {
    if (part.doubleSided) gl.disable(gl.CULL_FACE);
    else gl.enable(gl.CULL_FACE);
    gl.bindBuffer(gl.ARRAY_BUFFER, part.vertexBuffer);
    for (const { location, size, offset } of attributes)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, MODEL_VERTEX_SIZE * 4, offset * 4);
    gl.bindTexture(gl.TEXTURE_2D, part.texture);
    gl.uniform1f(cutoff, part.alphaMode === "MASK" ? part.alphaCutoff : 0);
    if ("indexBuffer" in part && part.indexBuffer && part.indexType) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.indexBuffer);
      gl.drawElements(gl.TRIANGLES, part.count, part.indexType, 0);
    } else gl.drawArrays(gl.TRIANGLES, 0, part.count);
  };

  const place = ({ center, size: dimensions, angle }: FurnitureInstance) => {
    gl.uniform4f(placement, center[0], center[1], Math.cos(angle), Math.sin(angle));
    gl.uniform3fv(size, dimensions);
  };

  const draw = (
    instances: FurnitureInstance[],
    view: XRView,
    position: [number, number, number],
    cos: number,
    sin: number
  ) => {
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(baseColor, 0);
    gl.uniformMatrix4fv(projection, false, view.projectionMatrix);
    gl.uniformMatrix4fv(camera, false, view.transform.inverse.matrix);
    gl.uniform3fv(origin, position);
    gl.uniform2f(roomTurn, cos, sin);
    gl.uniform1i(blended, 0);
    for (const { location } of attributes) gl.enableVertexAttribArray(location);
    gl.cullFace(gl.BACK);

    const transparent: { instance: FurnitureInstance; part: RenderPart; distance: number }[] = [];
    const eye = view.transform.position;
    for (const instance of instances) {
      place(instance);
      for (const part of partsFor(instance.model)) {
        if (part.alphaMode === "BLEND") {
          const [x, z] = instance.center;
          const dx = position[0] + x * cos - z * sin - eye.x;
          const dy = position[1] + instance.size[1] / 2 - eye.y;
          const dz = position[2] + x * sin + z * cos - eye.z;
          transparent.push({ instance, part, distance: dx * dx + dy * dy + dz * dz });
        } else drawPart(part);
      }
    }

    if (transparent.length) {
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(blended, 1);
      transparent.sort((a, b) => b.distance - a.distance);
      for (const { instance, part } of transparent) {
        place(instance);
        drawPart(part);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.disable(gl.CULL_FACE);
    for (const { location } of attributes) gl.disableVertexAttribArray(location);
  };

  const dispose = () => {
    buffers.forEach((buffer) => gl.deleteBuffer(buffer));
    textures.forEach((texture) => gl.deleteTexture(texture));
    gl.deleteProgram(program);
  };

  return { draw, dispose };
};
