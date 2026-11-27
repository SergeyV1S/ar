import type { FormEvent } from "react";

import { readText } from "../../../shared/helpers/index.ts";
import type { ProcurementProps } from "../components/index.ts";
import { procurementFields } from "../data/index.ts";

export const useProcurement = ({ save }: ProcurementProps) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save(
      Object.fromEntries(Object.keys(procurementFields).map((key) => [key, readText(data, key)]))
    );
  };

  return { submit };
};
