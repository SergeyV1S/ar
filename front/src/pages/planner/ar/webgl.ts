export const createProgram = (gl: WebGLRenderingContext, vertex: string, fragment: string) => {
  const compile = (kind: number, source: string) => {
    const shader = gl.createShader(kind);
    if (!shader) throw new Error("Не удалось создать шейдер.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Не удалось подготовить 3D-графику. ${log ?? ""}`);
  };

  const program = gl.createProgram();
  if (!program) throw new Error("Не удалось создать 3D-программу.");
  const shaders: WebGLShader[] = [];
  try {
    shaders.push(compile(gl.VERTEX_SHADER, vertex));
    shaders.push(compile(gl.FRAGMENT_SHADER, fragment));
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Не удалось запустить 3D-графику.");
    }
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
};
