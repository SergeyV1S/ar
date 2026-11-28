import { Button, Field, Icon } from "../../../shared/components/index.ts";
import { useVoice } from "../hooks/index.ts";
import type { Project, VoicePatch } from "../types/index.ts";

export type VoiceProps = {
  project: Project;
  apply: (patch: VoicePatch) => void;
};

export const Voice = (props: VoiceProps) => {
  const {
    phrase,
    message,
    canRecord,
    isBusy,
    isRecording,
    buttonLabel,
    notes,
    toggleRecording,
    changePhrase,
    applyVoice
  } = useVoice(props);
  return (
    <>
      <p className='support-text'>
        Например: «Комната 4 на 3, диван 2 метра, бюджет 80 тысяч, материал ЛДСП».
      </p>
      {canRecord ? (
        <>
          <Button
            icon='mic'
            className='ar-soft'
            disabled={isBusy && !isRecording}
            onClick={toggleRecording}
          >
            {buttonLabel}
          </Button>
          <span className='sr-only' role='status'>
            {isBusy && buttonLabel}
          </span>
          <p className='support-text'>Запись отправляется в Groq для распознавания.</p>
        </>
      ) : (
        <p className='notice'>
          Запись с микрофона недоступна. Можно ввести текст или использовать диктовку клавиатуры.
        </p>
      )}
      <Field className='mt-3' label='Размеры и пожелания'>
        <textarea
          rows={4}
          value={phrase}
          readOnly={isBusy}
          onChange={changePhrase}
          placeholder='Комната 4 на 3…'
        />
      </Field>
      {message && (
        <p className='form-error' role='alert'>
          {message}
        </p>
      )}
      {notes.length > 0 ? (
        <div className='check-list'>
          {notes.map((note) => (
            <div key={note}>
              <Icon name='checkCircle' size={17} />
              {note}
            </div>
          ))}
        </div>
      ) : (
        phrase.trim() && (
          <p className='support-text'>
            Попробуйте указать комнату, размеры дивана или бюджет цифрами.
          </p>
        )
      )}
      <div className='form-actions'>
        <Button
          icon='check'
          className='primary'
          disabled={!notes.length || isBusy}
          onClick={applyVoice}
        >
          Проверено, применить
        </Button>
      </div>
    </>
  );
};
