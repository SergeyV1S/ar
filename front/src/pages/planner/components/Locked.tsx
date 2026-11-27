import { Field, Icon } from "../../../shared/components/index.ts";
import { useLocked } from "../hooks/index.ts";
import { Brand } from "./Brand.tsx";

export type LockedProps = {
  unlock: (password: FormDataEntryValue | null) => void;
  error: string;
  busy: boolean;
  cancel?: () => void;
};

export const Locked = (props: LockedProps) => {
  const { error, busy, cancel } = props;
  const { submit } = useLocked(props);
  return (
    <main className='w-[min(420px,_calc(100%_-_32px))] my-16.25 mx-auto'>
      <Brand link={false} />
      <section className='panel locked-card'>
        <span className='heading-icon'>
          <Icon name='lock' />
        </span>
        <h1>Проект защищён</h1>
        <p className='support-text'>Введите пароль, чтобы открыть план и смету.</p>
        <form onSubmit={submit}>
          <Field label='Пароль проекта'>
            <input
              name='password'
              type='password'
              autoComplete='current-password'
              required
              autoFocus
            />
          </Field>
          {error && (
            <p className='form-error' role='alert'>
              {error}
            </p>
          )}
          <button className='btn primary' type='submit' disabled={busy}>
            <Icon name='lock' />
            {busy ? "Открываем…" : "Открыть проект"}
          </button>
        </form>
        {cancel && (
          <button className='btn' onClick={cancel} disabled={busy}>
            Отмена импорта
          </button>
        )}
      </section>
    </main>
  );
};
