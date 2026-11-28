import type { ApiRequest } from "@/shared/api";
import { api } from "@/shared/api/instance";

type SpeechTranscriptionParams = { recording: Blob };
type SpeechTranscription = { text: string };

export const postSpeechTranscriptions = async ({
  params,
  config
}: ApiRequest<SpeechTranscriptionParams>): Promise<SpeechTranscription> => {
  const form = new FormData();
  form.set("file", params.recording, "recording");

  const { data } = await api.post<unknown>("/speech/transcriptions", form, config);
  if (
    typeof data === "object" &&
    data !== null &&
    "text" in data &&
    typeof data.text === "string" &&
    data.text.trim()
  ) {
    return { text: data.text.trim() };
  }
  throw new Error("Invalid speech transcription response");
};
