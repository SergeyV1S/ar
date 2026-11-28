export const PLANNER_STEP = { room: "room", furniture: "furniture", wishes: "wishes", layout: "layout" } as const;

export const PLANNER_STEPS = [
  { id: PLANNER_STEP.room, title: "Комната" },
  { id: PLANNER_STEP.furniture, title: "Мебель" },
  { id: PLANNER_STEP.wishes, title: "Подбор" },
  { id: PLANNER_STEP.layout, title: "Расстановка" }
] as const;

export type PlannerStep = (typeof PLANNER_STEPS)[number]["id"];

export const ROOM_FORM_ID = "planner-room-form";
