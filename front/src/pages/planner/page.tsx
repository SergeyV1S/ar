import { Planner, ProjectHeader } from "./components/index.ts";

export const PlannerPage = () => {
  return (
    <div className='planner-flow'>
      <ProjectHeader />
      <Planner />
    </div>
  );
};
