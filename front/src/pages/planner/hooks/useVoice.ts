import axios from "axios";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { postSpeechTranscriptions } from "@/shared/api/requests";

import type { VoiceProps } from "../components/index.ts";
import { getRecordingType, getTranscriptionError } from "../helpers/index.ts";
import { parseVoice } from "../mock/index.ts";

const RECORDING_LIMIT_MS = 60_000;
const RECORDING_ERROR = "Не удалось записать звук. Попробуйте ещё раз или введите фразу вручную.";

const BUTTON_LABELS = {
  idle: "Говорить",
  requesting: "Ожидание доступа к микрофону…",
  recording: "Остановить запись",
  transcribing: "Распознаём запись…"
} as const;

type VoiceStage = keyof typeof BUTTON_LABELS;

type VoiceSession = {
  controller: AbortController;
  stream?: MediaStream;
  recorder?: MediaRecorder;
  timer?: number;
  stopRequested?: boolean;
};

const stopTracks = (stream?: MediaStream) => stream?.getTracks().forEach((track) => track.stop());

const releaseMicrophone = (session: VoiceSession) => {
  window.clearTimeout(session.timer);
  const recorder = session.recorder;
  if (recorder) {
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
    if (recorder.state !== "inactive") recorder.stop();
  }
  stopTracks(session.stream);
  session.stream = undefined;
  session.recorder = undefined;
};

export const useVoice = ({ project, apply }: VoiceProps) => {
  const [phrase, setPhrase] = useState("");
  const [stage, setStage] = useState<VoiceStage>("idle");
  const [message, setMessage] = useState("");
  const activeSession = useRef<VoiceSession | null>(null);
  const recordingType = getRecordingType();
  const { patch, notes } = parseVoice(phrase, project);

  useEffect(() => () => {
    const session = activeSession.current;
    if (!session) return;
    activeSession.current = null;
    session.controller.abort();
    releaseMicrophone(session);
  }, []);

  const finishSession = (session: VoiceSession) => {
    if (activeSession.current !== session) return;
    activeSession.current = null;
    releaseMicrophone(session);
    setStage("idle");
  };

  const failRecording = (session: VoiceSession, error: string) => {
    if (activeSession.current !== session) return;
    setMessage(error);
    finishSession(session);
  };

  const transcribe = async (session: VoiceSession, recording: Blob) => {
    if (activeSession.current !== session) return;
    if (recording.size === 0) {
      failRecording(session, RECORDING_ERROR);
      return;
    }
    releaseMicrophone(session);
    try {
      const { text } = await postSpeechTranscriptions({
        params: { recording },
        config: { signal: session.controller.signal }
      });
      if (activeSession.current === session) setPhrase(text);
    } catch (error: unknown) {
      if (!axios.isCancel(error) && activeSession.current === session) {
        setMessage(getTranscriptionError(error));
      }
    } finally {
      finishSession(session);
    }
  };

  const stopRecording = (session: VoiceSession) => {
    if (activeSession.current !== session || session.recorder?.state !== "recording") return;
    session.stopRequested = true;
    session.recorder.stop();
    setStage("transcribing");
  };

  const startRecording = async (mimeType: string) => {
    if (activeSession.current) return;
    const session: VoiceSession = { controller: new AbortController() };
    activeSession.current = session;
    setMessage("");
    setStage("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeSession.current !== session) {
        stopTracks(stream);
        return;
      }
      session.stream = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      session.recorder = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) chunks.push(data);
      };
      recorder.onerror = () => failRecording(session, RECORDING_ERROR);
      recorder.onstop = () => {
        if (!session.stopRequested) {
          failRecording(session, RECORDING_ERROR);
          return;
        }
        const type = (recorder.mimeType || mimeType).split(";")[0];
        void transcribe(session, new Blob(chunks, { type }));
      };

      recorder.start();
      session.timer = window.setTimeout(() => stopRecording(session), RECORDING_LIMIT_MS);
      setStage("recording");
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        failRecording(session, "Доступ к микрофону запрещён. Введите фразу вручную.");
        return;
      }
      failRecording(session, RECORDING_ERROR);
    }
  };

  const toggleRecording = () => {
    if (stage === "recording" && activeSession.current) {
      stopRecording(activeSession.current);
      return;
    }
    if (recordingType) void startRecording(recordingType);
  };

  const changePhrase = (event: ChangeEvent<HTMLTextAreaElement>) => setPhrase(event.target.value);
  const applyVoice = () => apply(patch);

  return {
    phrase,
    message,
    canRecord: Boolean(recordingType),
    isBusy: stage !== "idle",
    isRecording: stage === "recording",
    buttonLabel: BUTTON_LABELS[stage],
    notes,
    toggleRecording,
    changePhrase,
    applyVoice
  };
};
