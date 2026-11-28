import { useLayoutThumbnail } from "../hooks/index.ts";
import type { Item, Positions, Room } from "../types/index.ts";

export const LayoutThumbnail = ({ room, items, positions }: { room: Room; items: Item[]; positions: Positions }) => {
  const canvas = useLayoutThumbnail(room, items, positions);
  return <canvas ref={canvas} className='layout-thumbnail' width={128} height={104} aria-hidden='true' />;
};
