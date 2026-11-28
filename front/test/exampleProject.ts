import { initialProject, legacyStarterItems } from "../src/pages/planner/mock/index.ts";

export const exampleProject = () => {
  const project = initialProject();
  return {
    ...project, budget: 80000, budgetConfirmed: true, items: legacyStarterItems(),
    room: {
      ...project.room, source: "manual",
      openings: [
        { id: "window", type: "window", wall: 0, offset: 1.36, width: 2.42, hinge: "start" },
        { id: "door", type: "door", wall: 2, offset: 0.23, width: 0.9, hinge: "start" },
        { id: "socket", type: "socket", wall: 1, offset: 0.97, width: 0.08, hinge: "start" }
      ]
    }
  };
};
