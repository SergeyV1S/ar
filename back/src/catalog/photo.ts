export const photoFrom = (value: unknown, hosts: RegExp) => {
  if (typeof value !== "string" || value.length > 2048) return;
  try {
    const photo = new URL(value);
    if (photo.protocol === "https:" && hosts.test(photo.host) && !photo.username && !photo.password)
      return photo.href;
  } catch {
    return;
  }
};
