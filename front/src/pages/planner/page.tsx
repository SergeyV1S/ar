import { Planner, ProjectHeader, RetailCatalog } from "./components/index.ts";
import { usePlannerContext } from "./hooks/index.ts";

export const PlannerPage = () => {
  const { project, action } = usePlannerContext();
  return (
    <>
      <ProjectHeader room={project.room} action={action} />
      <Planner />
      {project.mode === "retail" && (
        <section className='panel editor-panel mt-4' aria-label='Подбор новой мебели'>
          <RetailCatalog />
        </section>
      )}
    </>
  );
};
