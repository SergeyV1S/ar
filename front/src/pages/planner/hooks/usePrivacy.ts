import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import type { PrivacyProps } from "../components/index.ts";

export const usePrivacy = ({ protect }: PrivacyProps) => {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [mismatch, setMismatch] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    protect(password);
  };
  const changePassword = (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);
  const changeConfirmation = (e: ChangeEvent<HTMLInputElement>) => {
    setConfirm(e.target.value);
    setMismatch(false);
  };

  return { password, confirm, mismatch, submit, changePassword, changeConfirmation };
};
