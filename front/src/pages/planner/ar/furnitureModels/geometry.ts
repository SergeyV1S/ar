import { Primitive, TextureInfo, WebIO } from "@gltf-transform/core";
import type { Accessor, Material, Node } from "@gltf-transform/core";
import { KHRTextureTransform } from "@gltf-transform/extensions";
import type { Transform } from "@gltf-transform/extensions";
import { mat3, mat4, vec3 } from "gl-matrix";

import { MODEL_VERTEX_SIZE } from "./types.ts";
import type { ModelPart, ModelSampler } from "./types.ts";

type ModelTexture = {
  bytes: Uint8Array<ArrayBuffer>;
  mimeType: string;
  size: readonly [number, number];
  sampler: ModelSampler;
};

type MeshSource = {
  node: Node;
  primitive: Primitive;
  positions: Accessor;
  indices: Accessor | null;
};

const readMaterial = (material: Material | null, textures: ModelTexture[]) => {
  const texture = material?.getBaseColorTexture();
  const info = material?.getBaseColorTextureInfo();
  const transform = info?.getExtension<Transform>(KHRTextureTransform.EXTENSION_NAME);
  let textureIndex = null;
  if (texture && info) {
    const bytes = texture.getImage();
    const size = texture.getSize();
    if (!bytes || !size) throw new Error("В модели отсутствует изображение для материала.");
    textureIndex = textures.length;
    textures.push({
      bytes,
      mimeType: texture.getMimeType(),
      size: [size[0], size[1]],
      sampler: {
        mag: info.getMagFilter() ?? TextureInfo.MagFilter.LINEAR,
        min: info.getMinFilter() ?? TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR,
        wrapS: info.getWrapS(),
        wrapT: info.getWrapT()
      }
    });
  }

  return {
    textureIndex,
    alphaMode: material?.getAlphaMode() ?? "OPAQUE",
    alphaCutoff: material?.getAlphaCutoff() ?? 0.5,
    doubleSided: material?.getDoubleSided() ?? false,
    factor: material?.getBaseColorFactor() ?? [1, 1, 1, 1],
    uvSet: transform?.getTexCoord() ?? info?.getTexCoord() ?? 0,
    uvScale: transform?.getScale() ?? [1, 1],
    uvOffset: transform?.getOffset() ?? [0, 0],
    uvRotation: transform?.getRotation() ?? 0
  } as const;
};

const readPart = (
  source: MeshSource[],
  material: ReturnType<typeof readMaterial>,
  min: vec3,
  max: vec3
): ModelPart => {
  const vertexCount = source.reduce((count, mesh) => count + mesh.positions.getCount(), 0);
  const indexCount = source.reduce(
    (count, mesh) => count + (mesh.indices?.getCount() ?? mesh.positions.getCount()),
    0
  );
  const vertices = new Float32Array(vertexCount * MODEL_VERTEX_SIZE);
  const indices = vertexCount > 65536 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const [uScale, vScale] = material.uvScale;
  const [uOffset, vOffset] = material.uvOffset;
  const cos = Math.cos(material.uvRotation);
  const sin = Math.sin(material.uvRotation);
  const position: [number, number, number] = [0, 0, 0];
  const normal: [number, number, number] = [0, 0, 0];
  const uv = [0, 0];
  const color = [1, 1, 1, 1];
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const { node, primitive, positions, indices: sourceIndices } of source) {
    const matrix = node.getWorldMatrix();
    const normalMatrix = mat3.normalFromMat4(mat3.create(), matrix);
    const flipped = mat4.determinant(matrix) < 0;
    const count = positions.getCount();
    const normals = primitive.getAttribute("NORMAL");
    const texcoords = primitive.getAttribute(`TEXCOORD_${material.uvSet}`);
    const colors = primitive.getAttribute("COLOR_0");
    uv.fill(0);
    color.fill(1);
    normal.fill(0);

    for (let i = 0; i < count; i++) {
      vec3.transformMat4(position, positions.getElement(i, position), matrix);
      vec3.min(min, min, position);
      vec3.max(max, max, position);
      if (normals && normalMatrix) {
        vec3.transformMat3(normal, normals.getElement(i, normal), normalMatrix);
        vec3.normalize(normal, normal);
      }
      texcoords?.getElement(i, uv);
      colors?.getElement(i, color);
      const u = uv[0] * uScale;
      const v = uv[1] * vScale;
      const offset = MODEL_VERTEX_SIZE * (vertexOffset + i);
      vertices.set(position, offset);
      vertices.set(normal, offset + 3);
      vertices[offset + 6] = u * cos - v * sin + uOffset;
      vertices[offset + 7] = u * sin + v * cos + vOffset;
      for (const channel of [0, 1, 2, 3])
        vertices[offset + 8 + channel] = color[channel] * material.factor[channel];
    }

    const countIndices = sourceIndices?.getCount() ?? count;
    const getIndex = (i: number) => {
      const index = sourceIndices?.getScalar(i) ?? i;
      if (!Number.isInteger(index) || index < 0 || index >= count)
        throw new Error("Некорректный индекс вершины модели мебели.");
      return vertexOffset + index;
    };
    for (let i = 0; i < countIndices; i += 3) {
      indices[indexOffset + i] = getIndex(i);
      indices[indexOffset + i + 1] = getIndex(i + (flipped ? 2 : 1));
      indices[indexOffset + i + 2] = getIndex(i + (flipped ? 1 : 2));
    }
    vertexOffset += count;
    indexOffset += countIndices;
  }

  const { textureIndex, alphaMode, alphaCutoff, doubleSided } = material;
  return { vertices, indices, textureIndex, alphaMode, alphaCutoff, doubleSided };
};

export const readFurnitureModel = async (bytes: Uint8Array) => {
  const io = new WebIO().registerExtensions([KHRTextureTransform]);
  const root = (await io.readBinary(bytes)).getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const meshes = new Map<Material | null, MeshSource[]>();
  scene?.traverse((node) => {
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const positions = primitive.getAttribute("POSITION");
      const indices = primitive.getIndices();
      if (
        !positions ||
        primitive.getMode() !== Primitive.Mode.TRIANGLES ||
        (indices?.getCount() ?? positions.getCount()) % 3 !== 0
      ) {
        throw new Error("Некорректная геометрия модели мебели.");
      }
      const material = primitive.getMaterial();
      const source = meshes.get(material) ?? [];
      source.push({ node, primitive, positions, indices });
      meshes.set(material, source);
    }
  });

  const min = vec3.fromValues(Infinity, Infinity, Infinity);
  const max = vec3.fromValues(-Infinity, -Infinity, -Infinity);
  const textures: ModelTexture[] = [];
  const parts = Array.from(meshes, ([material, source]) =>
    readPart(source, readMaterial(material, textures), min, max)
  );
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as const;
  if (size.some((value) => !Number.isFinite(value) || value <= 0))
    throw new Error("Некорректные габариты модели мебели.");

  parts.forEach(({ vertices }) => {
    for (let i = 0; i < vertices.length; i += MODEL_VERTEX_SIZE) {
      for (const axis of [0, 1, 2]) {
        vertices[i + axis] = (vertices[i + axis] - min[axis]) / size[axis];
        vertices[i + axis + 3] *= size[axis];
      }
    }
  });
  return { size, parts, textures };
};
