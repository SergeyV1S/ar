const maxPhotoLength = 260_000;

export const isRoomPhoto = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= maxPhotoLength &&
  /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value);

export const encodeRoomPhoto = (canvas: HTMLCanvasElement) => {
  for (const quality of [0.78, 0.6, 0.42]) {
    const photo = canvas.toDataURL("image/jpeg", quality);
    if (isRoomPhoto(photo)) return photo;
  }
  throw new Error("Не удалось сохранить фотографию. Попробуйте другое фото.");
};

export const encodeRoomFrame = (image: ImageData) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Сохранение кадра недоступно.");
  context.putImageData(image, 0, 0);
  return encodeRoomPhoto(canvas);
};
