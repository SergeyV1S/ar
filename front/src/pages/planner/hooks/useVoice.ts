import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { postSpeechTranscriptions } from "@/shared/api/requests";
import axios from "axios";

import type { VoiceProps } from "../components/index.ts";
import { NO_SPEECH_MESSAGE, getTranscriptionError } from "../helpers/index.ts";
import { parseVoice } from "../mock/index.ts";
import {
  CHUNK_SECONDS,
  MAX_DRAFT_CHUNKS,
  canCaptureVoice,
  encodeVoiceWav,
  startVoiceCapture
} from "../voice/index.ts";

const RECORDING_ERROR = "Не удалось записать звук. Попробуйте ещё раз или введите фразу вручную.";

const BUTTON_LABELS = {
  idle: "Говорить",
  requesting: "Ожидание доступа к микрофону…",
  recording: "Остановить запись",
  transcribing: "Уточняем запись…"
} as const;

type VoiceStage = keyof typeof BUTTON_LABELS;
type Transcript = { text: string; draftOf?: symbol };

type VoiceSession = {
  id: symbol;
  controller: AbortController;
  capture?: Awaited<ReturnType<typeof startVoiceCapture>>;
  chunks: Float32Array[];
  nextDraftChunk: number;
  draftRequest?: AbortController;
  finishing: boolean;
};

const cancelSession = (session: VoiceSession) => {
  session.controller.abort();
  session.draftRequest?.abort();
  session.chunks.length = 0;
};

export const useVoice = ({ project, apply }: VoiceProps) => {
  const [transcript, setTranscript] = useState<Transcript>({ text: "" });
  const [stage, setStage] = useState<VoiceStage>("idle");
  const [message, setMessage] = useState("");
  const activeSession = useRef<VoiceSession | null>(null);
  const canRecord = canCaptureVoice();
  const phrase = transcript.text;
  const { patch, notes } = parseVoice(stage === "idle" ? phrase : "", project);

  useEffect(
    () => () => {
      const session = activeSession.current;
      activeSession.current = null;
      if (session) cancelSession(session);
    },
    []
  );

  const finishSession = (session: VoiceSession, error?: string) => {
    if (activeSession.current !== session) return;
    activeSession.current = null;
    cancelSession(session);
    if (error) setMessage(error);
    setStage("idle");
  };

  const transcribeNextChunk = async (session: VoiceSession) => {
    if (activeSession.current !== session || session.finishing || session.draftRequest) return;
    if (session.nextDraftChunk >= MAX_DRAFT_CHUNKS) return;
    const chunk = session.chunks[session.nextDraftChunk];
    const sampleRate = session.capture?.sampleRate;
    if (!chunk || !sampleRate || chunk.length !== sampleRate * CHUNK_SECONDS) return;

    const request = new AbortController();
    session.draftRequest = request;
    session.nextDraftChunk += 1;
    try {
      const recording = await encodeVoiceWav([chunk], sampleRate);
      if (!recording || request.signal.aborted) return;
      const result = await postSpeechTranscriptions({
        params: { recording },
        config: { signal: request.signal }
      });
      if (!result || request.signal.aborted) return;
      setTranscript((current) => ({
        text: current.draftOf === session.id ? `${current.text} ${result.text}` : result.text,
        draftOf: session.id
      }));
    } catch (error: unknown) {
      if (!axios.isCancel(error) && !request.signal.aborted)
        finishSession(session, getTranscriptionError(error));
    } finally {
      session.draftRequest = undefined;
      void transcribeNextChunk(session);
    }
  };

  const beginFinalTranscription = (session: VoiceSession) => {
    session.finishing = true;
    session.draftRequest?.abort();
    setStage("transcribing");
  };

  const transcribeFullRecording = async (session: VoiceSession) => {
    if (activeSession.current !== session || !session.capture) return;
    beginFinalTranscription(session);
    const { signal } = session.controller;
    try {
      const recording = await encodeVoiceWav(session.chunks, session.capture.sampleRate);
      if (signal.aborted) return;
      if (!recording) {
        finishSession(session, RECORDING_ERROR);
        return;
      }
      const result = await postSpeechTranscriptions({ params: { recording }, config: { signal } });
      if (signal.aborted) return;
      if (result) setTranscript({ text: result.text });
      finishSession(session, result ? undefined : NO_SPEECH_MESSAGE);
    } catch (error: unknown) {
      if (!axios.isCancel(error) && !signal.aborted)
        finishSession(session, getTranscriptionError(error));
    }
  };

  const startRecording = async () => {
    if (activeSession.current) return;
    const session: VoiceSession = {
      id: Symbol(),
      controller: new AbortController(),
      chunks: [],
      nextDraftChunk: 0,
      finishing: false
    };
    activeSession.current = session;
    setMessage("");
    setStage("requesting");

    try {
      session.capture = await startVoiceCapture({
        signal: session.controller.signal,
        onChunk: (samples) => {
          session.chunks.push(samples);
          void transcribeNextChunk(session);
        },
        onStop: () => void transcribeFullRecording(session),
        onError: () => finishSession(session, RECORDING_ERROR)
      });
      if (activeSession.current === session) setStage("recording");
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        finishSession(session, "Доступ к микрофону запрещён. Введите фразу вручную.");
        return;
      }
      finishSession(session, RECORDING_ERROR);
    }
  };

  const toggleRecording = () => {
    const session = activeSession.current;
    if (stage === "recording" && session?.capture) {
      beginFinalTranscription(session);
      session.capture.stop();
      return;
    }
    if (canRecord) void startRecording();
  };

  const changePhrase = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setTranscript((current) => ({ ...current, text }));
  };
  const applyVoice = () => apply(patch);

  return {
    phrase,
    message,
    canRecord,
    isDraft: transcript.draftOf !== undefined,
    isBusy: stage !== "idle",
    isRecording: stage === "recording",
    buttonLabel: BUTTON_LABELS[stage],
    notes,
    toggleRecording,
    changePhrase,
    applyVoice
  };
};
