import assert from "node:assert/strict";
import { test } from "node:test";

type TestPort = {
  onmessage?: () => void;
  messages: unknown[];
  postMessage: (data: unknown, transfer?: ArrayBuffer[]) => void;
};

class TestAudioWorkletProcessor {
  readonly port: TestPort = {
    messages: [],
    postMessage: (data, transfer) => this.port.messages.push(structuredClone(data, { transfer }))
  };
}

type Processor = TestAudioWorkletProcessor & { process: (inputs: Float32Array[][]) => boolean };

const sampleRate = 44_100;
let createProcessor: (() => Processor) | undefined;

Object.assign(globalThis, {
  AudioWorkletProcessor: TestAudioWorkletProcessor,
  sampleRate,
  registerProcessor: (_name: string, Capture: new () => Processor) => {
    createProcessor = () => new Capture();
  }
});

await import("../src/pages/planner/voice/capture.worklet.ts");

test("sends a three-second chunk while capturing and preserves the tail on stop", () => {
  assert.ok(createProcessor);
  const capture = createProcessor();
  const samples = new Float32Array(132_480);
  samples[132_299] = 0.25;
  samples[132_300] = 0.5;
  samples[132_479] = 0.75;

  for (let offset = 0; offset < samples.length; offset += 128) {
    assert.equal(capture.process([[samples.subarray(offset, offset + 128)]]), true);
  }
  const [chunk] = capture.port.messages;
  assert.ok(chunk instanceof Float32Array);
  assert.equal(chunk.length, 132_300);
  assert.equal(chunk.at(-1), 0.25);
  assert.equal(capture.port.messages.length, 1);

  capture.port.onmessage?.();
  const [, tail, stopped] = capture.port.messages;
  assert.ok(tail instanceof Float32Array);
  assert.equal(tail.length, 180);
  assert.equal(tail[0], 0.5);
  assert.equal(tail.at(-1), 0.75);
  assert.equal(stopped, "stopped");
});

test("caps capture at 60 seconds even when a render block crosses the limit", () => {
  assert.ok(createProcessor);
  const capture = createProcessor();
  const block = new Float32Array(128);
  const lastBlock = Math.floor(2_646_000 / block.length);

  for (let index = 0; index < lastBlock; index += 1) capture.process([[block]]);
  assert.equal(capture.process([[block]]), false);
  capture.port.onmessage?.();

  const { messages } = capture.port;
  assert.equal(messages.length, 21);
  assert.equal(messages.at(-1), "stopped");
  assert.ok(
    messages
      .slice(0, -1)
      .every((chunk) => chunk instanceof Float32Array && chunk.length === 132_300)
  );
});
