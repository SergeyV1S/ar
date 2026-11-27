import type { ProjectHeaderProps } from "../components/index.ts";
import { area } from "../planning/index.ts";

export const useProjectHeader = ({ room, action }: ProjectHeaderProps) => {
  const openProjects = () => action("projects");
  const openExport = () => action("export");
  const replan = () => action("replan");
  const roomArea = area(room.points);
  return { roomArea, openProjects, openExport, replan };
};
