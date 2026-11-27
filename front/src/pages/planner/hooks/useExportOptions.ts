import type { ExportOptionsProps } from "../components/index.ts";
import { procurementMissing } from "../mock/index.ts";

export const useExportOptions = ({ project, action, run }: ExportOptionsProps) => {
  const missing = project.mode === "office" ? procurementMissing(project) : [];

  const openProcurement = () => action("procurement");
  const exportPdf = () => run("pdf");
  const exportCsv = () => run("csv");
  const exportJson = () => run("json");

  return { missing, openProcurement, exportPdf, exportCsv, exportJson };
};
