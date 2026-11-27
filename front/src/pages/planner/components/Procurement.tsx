import { Field } from "../../../shared/components/index.ts";
import { useProcurement } from "../hooks/index.ts";
import { procurementFields } from "../mock/index.ts";
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
              name={key}
              rows={3}
              maxLength={1500}
              defaultValue={project.procurement[key]}
            />
          ) : (
            <input
              name={key}
              type='text'
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
