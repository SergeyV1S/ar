import { CHUNK_SECONDS, RECORDING_SECONDS } from "./limits.ts";

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const registerProcessor: (name: string, processor: typeof AudioWorkletProcessor) => void;

class VoiceCapture extends AudioWorkletProcessor {
  private samples = new Float32Array(sampleRate * CHUNK_SECONDS);
  private filled = 0;
  private total = 0;
  private stopped = false;

  constructor() {
    super();
    this.port.onmessage = () => this.stop();
  }

  private send = (samples: Float32Array<ArrayBuffer>) => {
    this.port.postMessage(samples, [samples.buffer]);
  };

  private stop = () => {
    if (this.stopped) return;
    this.stopped = true;
    if (this.filled > 0) this.send(this.samples.slice(0, this.filled));
    this.port.postMessage("stopped");
  };

  process = (inputs: Float32Array[][]) => {
    if (this.stopped) return false;
    const input = inputs[0]?.[0];
    if (!input) return true;

    const limit = sampleRate * RECORDING_SECONDS;
    for (let offset = 0; offset < input.length && this.total < limit;) {
      const count = Math.min(
        input.length - offset,
        this.samples.length - this.filled,
        limit - this.total
      );
      this.samples.set(input.subarray(offset, offset + count), this.filled);
      this.filled += count;
      this.total += count;
      offset += count;
      if (this.filled === this.samples.length) {
        this.send(this.samples);
        this.samples = new Float32Array(sampleRate * CHUNK_SECONDS);
        this.filled = 0;
      }
    }
    if (this.total >= limit) this.stop();
    return !this.stopped;
  };
}

registerProcessor("voice-capture", VoiceCapture);
