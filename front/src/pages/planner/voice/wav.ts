const WAV_SAMPLE_RATE = 16_000;
const WAV_HEADER_BYTES = 44;
const WAV_SAMPLE_BYTES = 2;

const getMonoSamples = async (chunks: Float32Array[], sampleRate: number, sampleCount: number) => {
  const length = Math.round((sampleCount * WAV_SAMPLE_RATE) / sampleRate);
  const context = new OfflineAudioContext(1, length, WAV_SAMPLE_RATE);
  const buffer = context.createBuffer(1, sampleCount, sampleRate);
  const sourceSamples = buffer.getChannelData(0);
  let offset = 0;
  for (const chunk of chunks) {
    sourceSamples.set(chunk, offset);
    offset += chunk.length;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  const rendered = await context.startRendering();
  return rendered.getChannelData(0);
};

export const encodeVoiceWav = async (chunks: Float32Array[], sampleRate: number) => {
  const sampleCount = chunks.reduce((count, chunk) => count + chunk.length, 0);
  // Groq accepts audio from 0.01 seconds. An immediate stop can capture less.
  if (sampleCount / sampleRate < 0.01) return null;

  const mono = await getMonoSamples(chunks, sampleRate, sampleCount);
  const dataBytes = mono.length * WAV_SAMPLE_BYTES;
  const wav = new DataView(new ArrayBuffer(WAV_HEADER_BYTES + dataBytes));
  wav.setUint32(0, 0x52494646); // RIFF
  wav.setUint32(4, wav.byteLength - 8, true);
  wav.setUint32(8, 0x57415645); // WAVE
  wav.setUint32(12, 0x666d7420); // fmt
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true); // PCM
  wav.setUint16(22, 1, true); // Mono
  wav.setUint32(24, WAV_SAMPLE_RATE, true);
  wav.setUint32(28, WAV_SAMPLE_RATE * WAV_SAMPLE_BYTES, true);
  wav.setUint16(32, WAV_SAMPLE_BYTES, true);
  wav.setUint16(34, WAV_SAMPLE_BYTES * 8, true);
  wav.setUint32(36, 0x64617461); // data
  wav.setUint32(40, dataBytes, true);
  mono.forEach((sample, index) => {
    const clipped = Math.max(-1, Math.min(1, sample));
    const pcm = Math.round(clipped * (clipped < 0 ? 32768 : 32767));
    wav.setInt16(WAV_HEADER_BYTES + index * WAV_SAMPLE_BYTES, pcm, true);
  });
  return new Blob([wav.buffer], { type: "audio/wav" });
};
