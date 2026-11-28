import assert from "node:assert/strict";
import test from "node:test";

import type { ImageRotation } from "../src/pages/planner/recognition/index.ts";
import {
  decodeLiveDetections,
  liveOutputChannels
} from "../src/pages/planner/recognition/liveDetections.ts";
import { liveInputSize, prepareLiveImage } from "../src/pages/planner/recognition/liveImage.ts";

test("letterboxing rotates raw camera pixels and preserves the upright aspect ratio", () => {
  const data = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255
  ]);
  const plane = liveInputSize ** 2;
  const sample = (values: Float32Array, x: number, y: number) =>
    [0, 1, 2].map((channel) => values[channel * plane + y * liveInputSize + x]);

  const orientations: [ImageRotation, number, number, number, number, number[]][] = [
    [0, 0, 156, 416, 104, [1, 0, 0]],
    [90, 156, 0, 104, 416, [1, 0, 0]],
    [180, 0, 156, 416, 104, [1, 1, 0]],
    [270, 156, 0, 104, 416, [1, 1, 0]]
  ];
  for (const [rotation, left, top, width, height, color] of orientations) {
    const frame = prepareLiveImage({ data, width: 4, height: 1, rotation });
    assert.deepEqual(frame.image, { left, top, width, height });
    assert.equal(frame.values.length, 3 * plane);
    assert.deepEqual(sample(frame.values, left, top), color);
    assert.deepEqual(sample(frame.values, 0, 0), Array<number>(3).fill(Math.fround(114 / 255)));
  }
});

test("YOLO11n keeps neighboring tables, removes duplicates and unpads the boxes", () => {
  const count = 7;
  const output = new Float32Array(liveOutputChannels * count);
  const setAnchor = (anchor: number, box: number[], category: number, score: number) => {
    box.forEach((value, channel) => {
      output[channel * count + anchor] = value;
    });
    output[(4 + category) * count + anchor] = score;
  };
  setAnchor(0, [108, 208, 120, 104], 60, 0.95);
  setAnchor(1, [110, 208, 120, 104], 60, 0.94);
  setAnchor(2, [172, 208, 120, 104], 60, 0.86);
  setAnchor(3, [108, 208, 120, 104], 56, 0.45);
  setAnchor(4, [300, 208, 120, 104], 59, 0.44);
  setAnchor(5, [300, 208, 120, 104], 60, 0.75);
  output[4 * count + 5] = 0.95; // person wins over table
  setAnchor(6, [244, 36, 90, 48], 13, 0.6); // wholly in the padding

  const matches = decodeLiveDetections(output, { left: 0, top: 104, width: 416, height: 208 });
  assert.deepEqual(
    matches.map(({ kind, title }) => [kind, title]),
    [
      ["table", "Стол"],
      ["table", "Стол"],
      ["stool", "Стул"]
    ]
  );
  assert.deepEqual(matches[0].box.map(Math.round), [12, 25, 29, 50]);
});
