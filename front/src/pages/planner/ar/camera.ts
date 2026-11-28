import { createProgram } from "./webgl.ts";

type RawCamera = { readonly width: number; readonly height: number };

declare global {
  interface XRView {
    readonly camera?: RawCamera | null;
  }

  interface XRWebGLBinding {
    getCameraImage?(camera: RawCamera): WebGLTexture | null;
  }
}

const vertexShader = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(0.5 + position.x * 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `
precision mediump float;
varying vec2 uv;
uniform sampler2D image;
void main() {
  gl_FragColor = texture2D(image, uv);
}`;

const maxDimension = 480;

const createImageReader = (gl: WebGLRenderingContext) => {
  const program = createProgram(gl, vertexShader, fragmentShader);
  const output = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const buffer = gl.createBuffer();
  const dispose = () => {
    gl.deleteTexture(output);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };
  if (!output || !framebuffer || !buffer) {
    dispose();
    throw new Error("Не удалось подготовить захват AR-кадра.");
  }
  const position = gl.getAttribLocation(program, "position");
  const sampler = gl.getUniformLocation(program, "image");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, output);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);
  let lastWidth = 0;
  let lastHeight = 0;

  const read = (texture: WebGLTexture, camera: RawCamera) => {
    const scale = Math.min(1, maxDimension / Math.max(camera.width, camera.height));
    const width = Math.max(1, Math.round(camera.width * scale));
    const height = Math.max(1, Math.round(camera.height * scale));
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.activeTexture(gl.TEXTURE0);
    if (width !== lastWidth || height !== lastHeight) {
      gl.bindTexture(gl.TEXTURE_2D, output);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Буфер захвата AR-кадра недоступен.");
      }
      lastWidth = width;
      lastHeight = height;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(sampler, 0);
    const image = new ImageData(width, height);
    try {
      // The shader flips Y so readPixels writes top-to-bottom image rows.
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.readPixels(
        0,
        0,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(image.data.buffer)
      );
    } finally {
      gl.disableVertexAttribArray(position);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    return image;
  };
  return { read, dispose };
};

export const createARCamera = (session: XRSession, gl: WebGLRenderingContext) => {
  if (typeof XRWebGLBinding === "undefined") return null;
  try {
    const binding = new XRWebGLBinding(session, gl);
    if (typeof binding.getCameraImage !== "function") return null;
    let reader: ReturnType<typeof createImageReader> | undefined;
    return {
      read(view: XRView) {
        const camera = view.camera;
        if (!camera) return null;
        const texture = binding.getCameraImage?.(camera);
        if (!texture) return null;
        reader ??= createImageReader(gl);
        return reader.read(texture, camera);
      },
      dispose: () => reader?.dispose()
    };
  } catch {
    return null;
  }
};
