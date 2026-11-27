import { createRoot } from "react-dom/client";

import "@fontsource-variable/manrope";

import { Providers, registerServiceWorker } from "./app/index.ts";
import "./app/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Корневой элемент приложения отсутствует.");
createRoot(root).render(<Providers />);

registerServiceWorker();
