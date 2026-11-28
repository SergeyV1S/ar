export const catalogPhotoUrl = (input: unknown) => {
  if (typeof input !== "string" || input.length > 2048) return;
  try {
    const photo = new URL(input);
    const trusted = /^(?:cdn\.servicecdn\.ru|(?:[\w-]+\.)*(?:divan\.ru|avito\.st))$/i;
    if (photo.protocol === "https:" && trusted.test(photo.host) && !photo.username && !photo.password)
      return photo.href;
  } catch {
    return;
  }
};
