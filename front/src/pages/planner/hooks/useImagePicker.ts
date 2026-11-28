import type { ChangeEvent } from "react";
import { useId, useRef, useState } from "react";

import type { ImagePickerProps } from "../components/index.ts";
import { encodeRoomPhoto } from "../helpers/roomPhoto.ts";

export const useImagePicker = ({ onPhoto }: ImagePickerProps) => {
  const pickerId = useId();
  const picker = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    picker.current?.hidePopover();
    let bitmap;
    try {
      if (!file.type.startsWith("image/") || file.size > 24 * 1024 * 1024)
        throw new Error("Выберите изображение до 24 МБ.");
      bitmap = await createImageBitmap(file);
      const factor = Math.min(1, 740 / Math.max(bitmap.width, bitmap.height));
      const image = document.createElement("canvas");
      image.width = Math.max(1, Math.round(bitmap.width * factor));
      image.height = Math.max(1, Math.round(bitmap.height * factor));
      const ctx = image.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D недоступен.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, image.width, image.height);
      ctx.drawImage(bitmap, 0, 0, image.width, image.height);
      onPhoto(encodeRoomPhoto(image));
      setError("");
    } catch (failure) {
      setError(
        (failure instanceof Error ? failure.message : "") || "Не удалось открыть фотографию."
      );
    } finally {
      bitmap?.close();
      event.target.value = "";
    }
  };

  return { error, load, picker, pickerId };
};
