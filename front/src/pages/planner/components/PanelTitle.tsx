import { Icon } from "../../../shared/components/index.ts";

export const PanelTitle = ({
  icon,
  title,
  count
}: {
  icon: string;
  title: string;
  count?: number;
}) => {
  return (
    <div className='panel-heading'>
      <span className='heading-icon'>
        <Icon name={icon} size={18} />
      </span>
      <h2>{title}</h2>
      {count !== undefined && <span className='count'>{count}</span>}
    </div>
  );
};
