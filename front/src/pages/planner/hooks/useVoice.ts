import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { VoiceProps } from "../components/index.ts";
import { parseVoice } from "../mock/index.ts";

export const useVoice = ({ project, apply }: VoiceProps) => {
  const [phrase, setPhrase] = useState(""),
    [listening, setListening] = useState(false),
    [message, setMessage] = useState("");
  const recognition = useRef<SpeechRecognition | null>(null);
  const browserRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const { patch, notes } = parseVoice(phrase, project);
  useEffect(
    () => () => {
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current.abort();
      }
    },
    []
  );
  const speak = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (!browserRecognition) return;
    try {
      const session = new browserRecognition();
      recognition.current = session;
      session.lang = "ru-RU";
      session.interimResults = true;
      session.continuous = false;
      session.onresult = (event) =>
        setPhrase(
          Array.from(event.results)
            .map((result) => result[0].transcript)
            .join(" ")
        );
      session.onerror = (event) =>
        setMessage(
          event.error === "not-allowed"
            ? "Микрофон недоступен. Введите фразу в поле ниже."
            : "Распознавание прервалось. Проверьте сеть или введите фразу."
        );
      session.onend = () => {
        setListening(false);
        recognition.current = null;
      };
      session.start();
      setMessage("");
      setListening(true);
    } catch {
      setMessage("Не удалось включить микрофон. Введите фразу вручную.");
    }
  };

  const changePhrase = (event: ChangeEvent<HTMLTextAreaElement>) => setPhrase(event.target.value);
  const applyVoice = () => apply(patch);

  return { phrase, listening, message, browserRecognition, notes, speak, changePhrase, applyVoice };
};
