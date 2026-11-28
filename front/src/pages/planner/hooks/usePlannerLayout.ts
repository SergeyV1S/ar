import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { PATHS } from "@/shared/constants/index.ts";

export const usePlannerLayout = () => {
  const { pathname } = useLocation();
  const previousPage = useRef(pathname);
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    if (previousPage.current === pathname) return;
    previousPage.current = pathname;
    content.current?.focus({ preventScroll: true });
  }, [pathname]);
  return { content, isPlannerPage: pathname === PATHS.planner };
};
