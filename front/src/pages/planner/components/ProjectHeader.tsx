export const ProjectHeader = () => {
  return (
    <header className='planner-hero'>
      <div className='planner-hero-copy'>
        <h1>Планировщик комнаты</h1>
        <p>Задайте размеры и расставьте мебель на плане.</p>
      </div>
      <img
        className='planner-hero-image'
        src={`${import.meta.env.BASE_URL}planner-living-room.webp`}
        width={1680}
        height={600}
        fetchPriority='high'
        alt=''
      />
    </header>
  );
};
