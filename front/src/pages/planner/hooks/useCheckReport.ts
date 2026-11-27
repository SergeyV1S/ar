import type { CheckReportProps } from "../components/index.ts";
import { getPassageMessage } from "../helpers/index.ts";

export const useCheckReport = ({ action, inspection, project }: CheckReportProps) => {
  const editRoom = () => action("room");

  return { editRoom, passageMessage: getPassageMessage(inspection, project.passage) };
};
