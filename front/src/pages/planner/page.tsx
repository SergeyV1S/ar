import { Planner, ProjectHeader } from "./components/index.ts";
import { usePlannerContext } from "./hooks/index.ts";

export const PlannerPage = () => {
  const { project, action } = usePlannerContext();
  return (
    <>
      <ProjectHeader room={project.room} action={action} />
      <Planner />
    </>
  );
};
