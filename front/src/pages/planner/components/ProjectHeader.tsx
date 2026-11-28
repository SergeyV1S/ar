import type { ReactNode } from "react";

export const ProjectHeader = ({
  title = "Планировщик комнаты",
  description = "Задайте размеры и расставьте мебель на плане.",
  illustrated = true,
  children
}: {
  title?: string;
  description?: string;
  illustrated?: boolean;
  children?: ReactNode;
}) => {
  return (
    <header className={illustrated ? "planner-hero" : "planner-hero planner-hero-compact"}>
      <div className='planner-hero-copy'>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {illustrated && <img
        className='planner-hero-image'
        src={`${import.meta.env.BASE_URL}planner-living-room.webp`}
        width={1680}
        height={600}
        fetchPriority='high'
        alt=''
      />}
      {children && <div className='editor-links'>{children}</div>}
    </header>
  );
};
