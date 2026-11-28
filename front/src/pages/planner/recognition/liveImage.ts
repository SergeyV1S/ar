import { cameraImagePoint } from "./imageRotation.ts";
import type { LiveFrame } from "./types.ts";

export const liveInputSize = 416;
const planeSize = liveInputSize ** 2;

const samplePosition = (pixel: number, sourceSize: number, targetSize: number) =>
  Math.min(sourceSize - 1, Math.max(0, ((pixel + 0.5) * sourceSize) / targetSize - 0.5));

export const prepareLiveImage = ({ data, width, height, rotation }: LiveFrame) => {
  const swapAxes = rotation === 90 || rotation === 270;
  const sourceWidth = swapAxes ? height : width;
  const sourceHeight = swapAxes ? width : height;
  const scale = liveInputSize / Math.max(sourceWidth, sourceHeight);
  const resizedWidth = Math.max(1, Math.round(sourceWidth * scale));
  const resizedHeight = Math.max(1, Math.round(sourceHeight * scale));
  const left = Math.floor((liveInputSize - resizedWidth) / 2);
  const top = Math.floor((liveInputSize - resizedHeight) / 2);
  const values = new Float32Array(3 * planeSize).fill(114 / 255);

  const [originX, originY] = cameraImagePoint(rotation, 0, 0);
  const [rightX, rightY] = cameraImagePoint(rotation, 1, 0);
  const [bottomX, bottomY] = cameraImagePoint(rotation, 0, 1);
  const origin = (originX * (width - 1) + originY * (height - 1) * width) * 4;
  const columnStep = (rightX - originX + (rightY - originY) * width) * 4;
  const rowStep = (bottomX - originX + (bottomY - originY) * width) * 4;

  for (let y = 0; y < resizedHeight; y++) {
    const sourceY = samplePosition(y, sourceHeight, resizedHeight);
    const row = Math.floor(sourceY);
    const dy = sourceY - row;
    const firstRow = origin + row * rowStep;
    const secondRow = origin + Math.min(row + 1, sourceHeight - 1) * rowStep;

    for (let x = 0; x < resizedWidth; x++) {
      const sourceX = samplePosition(x, sourceWidth, resizedWidth);
      const column = Math.floor(sourceX);
      const dx = sourceX - column;
      const firstColumn = column * columnStep;
      const secondColumn = Math.min(column + 1, sourceWidth - 1) * columnStep;
      const target = (top + y) * liveInputSize + left + x;

      for (let channel = 0; channel < 3; channel++) {
        const a = data[firstRow + firstColumn + channel];
        const b = data[firstRow + secondColumn + channel];
        const c = data[secondRow + firstColumn + channel];
        const d = data[secondRow + secondColumn + channel];
        const upper = a + (b - a) * dx;
        const lower = c + (d - c) * dx;
        values[channel * planeSize + target] = (upper + (lower - upper) * dy) / 255;
      }
    }
  }

  return { values, image: { left, top, width: resizedWidth, height: resizedHeight } };
};
