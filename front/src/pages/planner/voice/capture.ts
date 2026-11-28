import workletUrl from "./capture.worklet.ts?worker&url";
import { RECORDING_SECONDS } from "./limits.ts";

type CaptureOptions = {
  signal: AbortSignal;
  onChunk: (samples: Float32Array) => void;
  onStop: () => void;
  onError: () => void;
};

const stopTracks = (stream?: MediaStream) => stream?.getTracks().forEach((track) => track.stop());

export const canCaptureVoice = () =>
  window.isSecureContext &&
  typeof navigator.mediaDevices?.getUserMedia === "function" &&
  typeof window.AudioContext === "function" &&
  typeof window.OfflineAudioContext === "function" &&
  typeof window.AudioWorkletNode === "function";

export const startVoiceCapture = async ({ signal, onChunk, onStop, onError }: CaptureOptions) => {
  const context = new AudioContext();
  let stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let worklet: AudioWorkletNode | undefined;
  let timer: number | undefined;
  let stopping = false;
  let disposed = false;

  const releaseMicrophone = () => {
    stream?.getAudioTracks().forEach((track) => track.removeEventListener("ended", fail));
    stopTracks(stream);
    stream = undefined;
    source?.disconnect();
    source = undefined;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(timer);
    signal.removeEventListener("abort", dispose);
    context.onstatechange = null;
    releaseMicrophone();
    if (worklet) {
      worklet.onprocessorerror = null;
      worklet.port.onmessage = null;
      worklet.port.close();
      worklet.disconnect();
    }
    void context.close().catch(() => undefined);
  };

  const fail = () => {
    if (disposed) return;
    dispose();
    onError();
  };

  const stop = () => {
    if (disposed || stopping || !worklet) return;
    stopping = true;
    window.clearTimeout(timer);
    releaseMicrophone();
    worklet.port.postMessage("stop");
    timer = window.setTimeout(fail, 1_000);
  };

  signal.addEventListener("abort", dispose, { once: true });
  try {
    signal.throwIfAborted();
    const microphone = navigator.mediaDevices.getUserMedia({ audio: true }).then((result) => {
      if (disposed) {
        stopTracks(result);
        return result;
      }
      stream = result;
      stream.getAudioTracks().forEach((track) => track.addEventListener("ended", fail));
      return result;
    });
    const [input] = await Promise.all([
      microphone,
      context.resume(),
      context.audioWorklet.addModule(workletUrl)
    ]);
    signal.throwIfAborted();
    if (!input.getAudioTracks().some((track) => track.readyState === "live")) {
      throw new Error("Microphone audio track is unavailable");
    }

    source = context.createMediaStreamSource(input);
    worklet = new AudioWorkletNode(context, "voice-capture", {
      channelCount: 1,
      channelCountMode: "explicit"
    });
    worklet.port.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (data instanceof Float32Array) onChunk(data);
      if (data === "stopped") {
        dispose();
        onStop();
      }
    };
    worklet.onprocessorerror = fail;
    context.onstatechange = () => {
      if (!stopping && context.state !== "running") fail();
    };
    source.connect(worklet).connect(context.destination);
    timer = window.setTimeout(stop, RECORDING_SECONDS * 1_000);
    return { sampleRate: context.sampleRate, stop };
  } catch (error) {
    dispose();
    throw error;
  }
};
