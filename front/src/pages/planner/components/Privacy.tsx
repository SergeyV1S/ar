import { Button, Field, Icon } from "../../../shared/components/index.ts";
import { usePrivacy } from "../hooks/index.ts";

export type PrivacyProps = {
  isProtected: boolean;
  protect: (password: string) => void;
  lock: () => void;
  error: string;
};

export const Privacy = (props: PrivacyProps) => {
  const { isProtected, lock, error } = props;
  const { password, confirm, mismatch, submit, changePassword, changeConfirmation } =
    usePrivacy(props);
  return (
    <form onSubmit={submit}>
      <p className='support-text'>
        Проект хранится в этом браузере. Для служебной закупки пароль обязателен. Он также защищает
        резервную копию JSON.
      </p>
      {isProtected ? (
        <div className='notice'>
          <Icon name='lock' />
          Проект зашифрован. Для повторного открытия понадобится пароль.
        </div>
      ) : (
        <>
          <Field
            label='Пароль проекта'
            hint='Не менее 8 символов. Сохраните пароль: восстановить его через приложение нельзя.'
          >
            <input
              type='password'
              minLength={8}
              maxLength={250}
              autoComplete='new-password'
              required
              value={password}
              onChange={changePassword}
            />
          </Field>
          <Field label='Повторите пароль'>
            <input
              type='password'
              minLength={8}
              maxLength={250}
              autoComplete='new-password'
              required
              value={confirm}
              onChange={changeConfirmation}
            />
          </Field>
        </>
      )}
      {(error || mismatch) && (
        <p className='form-error' role='alert'>
          {error || "Пароли не совпадают."}
        </p>
      )}
      <div className='form-actions'>
        {isProtected ? (
          <Button icon='lock' className='primary' onClick={lock}>
            Заблокировать
          </Button>
        ) : (
          <button className='btn primary' type='submit'>
            <Icon name='lock' />
            Зашифровать
          </button>
        )}
      </div>
    </form>
  );
};
