export const ProjectHeader = ({
  cover = "studio-room",
  title = "Планировщик комнаты",
  description = "Задайте размеры и расставьте мебель на плане."
}: {
  cover?: "studio-room" | "studio-catalog" | "studio-estimate";
  title?: string;
  description?: string;
}) => (
  <header className='planner-hero'>
    <div className='planner-hero-copy'>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    <img className='planner-hero-image' src={`${import.meta.env.BASE_URL}${cover}.webp`}
      width={1536} height={1024} fetchPriority='high' alt='' />
  </header>
);
