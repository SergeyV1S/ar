import { useLayoutEffect, useRef } from "react";
import { useSearchParams } from "react-router";

import { PLANNER_STEP, PLANNER_STEPS } from "../helpers/index.ts";
import type { PlannerStep } from "../helpers/index.ts";

export const usePlannerSteps = () => {
  const [search, setSearch] = useSearchParams();
  const requestedStep = search.get("step");
  const step = PLANNER_STEPS.find(({ id }) => id === requestedStep)?.id ?? PLANNER_STEP.room;
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);

  useLayoutEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus();
  }, [step]);

  const goToStep = (next: PlannerStep) => {
    if (next === step) return;
    const params = new URLSearchParams(search);
    if (next === PLANNER_STEP.room) params.delete("step");
    else params.set("step", next);
    setSearch(params, { preventScrollReset: true });
  };

  const stepOptions = PLANNER_STEPS.map(({ id, title }, index) => {
    const selectStep = () => goToStep(id);
    return {
      id,
      title,
      number: index + 1,
      selectStep,
      submitRoom: step === PLANNER_STEP.room && id !== step
    };
  });
  const onRoomSaved = (target: string | undefined) => {
    goToStep(target === PLANNER_STEP.layout ? PLANNER_STEP.layout : PLANNER_STEP.furniture);
  };
  const goToRoom = () => goToStep(PLANNER_STEP.room);
  const goToLayout = () => goToStep(PLANNER_STEP.layout);

  return { step, stepOptions, heading, onRoomSaved, goToRoom, goToLayout };
};
