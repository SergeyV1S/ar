import { Field } from "../../../shared/components/index.ts";
import { procurementFields } from "../data/index.ts";
import { useProcurement } from "../hooks/index.ts";
import type { Project } from "../types/index.ts";
import { Submit } from "./Submit.tsx";

export type ProcurementProps = {
  project: Project;
  save: (fields: Project["procurement"]) => void;
  close: () => void;
};

export const Procurement = (props: ProcurementProps) => {
  const { project, close } = props;
  const { submit } = useProcurement(props);
  return (
    <form onSubmit={submit}>
      {Object.entries(procurementFields).map(([key, label]) => (
        <Field key={key} label={label}>
          {key === "reason" ? (
            <textarea
              required
              name={key}
              rows={3}
              maxLength={1500}
              defaultValue={project.procurement[key]}
            />
          ) : (
            <input
              required
              name={key}
              type={key === "offer" ? "url" : "text"}
              pattern={key === "offer" ? "https?://.+" : undefined}
              maxLength={1500}
              defaultValue={project.procurement[key]}
            />
          )}
        </Field>
      ))}
      <Submit close={close} />
    </form>
  );
};
