import { createContext } from "react";

import type { usePlannerPage } from "../hooks/index.ts";

export const plannerContext = createContext<ReturnType<typeof usePlannerPage> | null>(null);
