export const getItemPath = (path: string, id: string | null) =>
  id === null ? path : `${path}?${new URLSearchParams({ item: id })}`;
