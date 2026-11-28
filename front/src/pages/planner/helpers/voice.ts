import axios from "axios";

const TIMEOUT_MESSAGE = "Распознавание заняло слишком много времени. Попробуйте ещё раз.";
export const NO_SPEECH_MESSAGE =
  "Не удалось разобрать речь. Запишите фразу ещё раз или введите её вручную.";

const ERROR_MESSAGES: Partial<Record<number, string>> = {
  413: "Запись слишком большая. Попробуйте надиктовать более короткую фразу.",
  415: "Формат записи не поддерживается. Введите фразу вручную.",
  422: NO_SPEECH_MESSAGE,
  429: "Достигнут лимит распознавания. Попробуйте позже или введите фразу вручную.",
  503: "Распознавание не настроено. Введите фразу вручную.",
  504: TIMEOUT_MESSAGE
};

export const getTranscriptionError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message = ERROR_MESSAGES[error.response?.status ?? 0];
    if (message) return message;
    if (error.code === "ECONNABORTED") return TIMEOUT_MESSAGE;
    if (!error.response) return "Не удалось отправить запись. Проверьте соединение с интернетом.";
  }
  return "Не удалось распознать запись. Попробуйте ещё раз или введите фразу вручную.";
};
