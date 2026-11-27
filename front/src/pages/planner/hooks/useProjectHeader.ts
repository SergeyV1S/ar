import type { ProjectHeaderProps } from "../components/index.ts";

export const useProjectHeader = ({ action }: ProjectHeaderProps) => {
  const openProjects = () => action("projects");
  return { openProjects };
};
