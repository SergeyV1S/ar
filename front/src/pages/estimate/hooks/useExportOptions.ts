import { procurementMissing } from "@/pages/planner/mock/index.ts";

import type { ExportOptionsProps } from "../components/index.ts";

export const useExportOptions = ({ project, action, run }: ExportOptionsProps) => {
  const missing = project.mode === "office" ? procurementMissing(project) : [];

  const openProcurement = () => action("procurement");
  const exportPdf = () => run("pdf");
  const exportCsv = () => run("csv");
  const exportPng = () => run("png");

  return { missing, openProcurement, exportPdf, exportCsv, exportPng };
};
