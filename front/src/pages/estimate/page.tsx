import { ProjectHeader } from "@/pages/planner/components/index.ts";
import { usePlannerContext } from "@/pages/planner/hooks/index.ts";

import { EstimateContent, ExportOptions, RoomVisualization } from "./components/index.ts";

export const EstimatePage = () => {
  const { project, bought, inspection, positions, action, exportData } = usePlannerContext();

  return (
    <div className='planner-flow'>
      <ProjectHeader cover='studio-estimate' title='Смета' description={project.room.name} />
      <div className='estimate-layout'>
        <section className='panel editor-panel' aria-label='Смета покупок'>
          <EstimateContent
            project={project}
            items={bought}
            inspection={inspection}
            positions={positions}
            action={action}
          />
        </section>
        <section className='panel editor-panel export-panel' aria-labelledby='estimate-export'>
          <h2 id='estimate-export'>Выгрузка</h2>
          <ExportOptions project={project} action={action} run={exportData} />
          <RoomVisualization />
        </section>
      </div>
    </div>
  );
};
