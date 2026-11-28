import type { ApiRequest } from "@/shared/api";
import { api } from "@/shared/api/instance";
import axios from "axios";

type SpeechTranscriptionParams = { recording: Blob };
type SpeechTranscription = { text: string };

export const postSpeechTranscriptions = async ({
  params,
  config
}: ApiRequest<SpeechTranscriptionParams>): Promise<SpeechTranscription | null> => {
  const form = new FormData();
  form.set("file", params.recording, "recording");

  const response = await api
    .post<unknown>("/speech/transcriptions", form, config)
    .catch((error: unknown) => {
      if (axios.isCancel(error)) throw error;
      if (axios.isAxiosError<unknown>(error) && error.response?.status === 422) {
        const data = error.response.data;
        if (
          typeof data === "object" &&
          data !== null &&
          "code" in data &&
          data.code === "NO_SPEECH"
        )
          return null;
      }
      throw error;
    });
  if (!response) return null;
  const { data } = response;
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
