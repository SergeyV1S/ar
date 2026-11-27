import { Icon } from "../../../shared/components/index.ts";
import { getThumbnailClass } from "../helpers/index.ts";
import type { Item } from "../types/index.ts";

export const Thumbnail = ({
  item,
  className = ""
}: {
  item: Partial<Item>;
  className?: string;
}) => {
  if (item.photo)
    return (
      <span className={`product-image ${className}`}>
        <img src={item.photo} alt='' />
      </span>
    );
  return (
    <span
      className={`product-image ${getThumbnailClass(item.illustration)} ${className}`}
      aria-hidden='true'
    >
      {!item.illustration && <Icon name={item.kind ?? "other"} size={24} />}
    </span>
  );
};
