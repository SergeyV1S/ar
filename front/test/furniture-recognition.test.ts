import assert from "node:assert/strict";
import test from "node:test";

import { decodeDetections } from "../src/pages/planner/recognition/detections.ts";
import queries from "../src/pages/planner/recognition/modelQueries.json" with { type: "json" };

test("furniture scores keep neighboring tables, ignore clutter and decode a pouf and bench", () => {
  const prompts = Object.keys(queries);
  const logits = new Float32Array(7 * prompts.length).fill(-8);
  const setLogit = (index: number, prompt: keyof typeof queries, value: number) => {
    logits[index * prompts.length + prompts.indexOf(prompt)] = value;
  };
  setLogit(0, "folding table", 3);
  setLogit(1, "office desk", 2); // duplicate of the folding table
  setLogit(2, "table", 3);
  setLogit(3, "cube ottoman", 2);
  setLogit(4, "upholstered bench", 2);
  setLogit(5, "ottoman", 2);
  setLogit(5, "box", 5);
  setLogit(6, "upholstered bench", -2);
  const boxes = new Float32Array([
    0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5, 0.25, 0.25, 0.25, 0.75, 0.4375, 0.25, 0.25,
    0.125, 0.4375, 0.25, 0.125, 0.25, 0.4375, 0.125, 0.125, 0.5, 0.4375, 0.125, 0.125
  ]);
  const matches = decodeDetections(logits, boxes, 1, 0.5);
  assert.deepEqual(
    matches.map(({ title }) => title),
    ["Стол", "Стол", "Пуф", "Скамья"]
  );
  assert.deepEqual(matches[2].box, [62.5, 62.5, 25, 37.5]);
  assert.equal(matches[2].kind, "pouf");
});
