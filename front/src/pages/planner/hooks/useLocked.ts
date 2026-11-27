import type { FormEvent } from "react";

import type { LockedProps } from "../components/index.ts";

export const useLocked = ({ unlock }: LockedProps) => {
  const ignoreBrand = () => {};
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    unlock(new FormData(event.currentTarget).get("password"));
  };

  return { ignoreBrand, submit };
};
