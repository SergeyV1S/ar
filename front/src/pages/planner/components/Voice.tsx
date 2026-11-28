import { Button, Field, Icon } from "../../../shared/components/index.ts";
import { money } from "../../../shared/helpers/index.ts";
import type { PlanAnalysis } from "../../../shared/helpers/index.ts";
import { useVoice } from "../hooks/index.ts";
import type { Item, Positions, Project, VoicePatch } from "../types/index.ts";

export type VoiceProps = {
  project: Project;
  apply: (patch: VoicePatch) => void;
  wishes?: { items: Item[]; positions: Positions; save: (phrase: string, analysis: PlanAnalysis) => void };
};

export const Voice = (props: VoiceProps) => {
  const {
    phrase,
    message,
    canRecord,
    isDraft,
    isBusy,
    isRecording,
    buttonLabel,
    notes,
    hasPurchase,
    toggleRecording,
    changePhrase,
    applyVoice,
    analysis,
    analyzing,
    analyze,
    saveAnalysis
  } = useVoice(props);
  return (
    <>
      <p className='support-text'>
        {props.wishes
          ? "Например: «Замени мой диван тканевым, шириной до 2 м. Добавь два деревянных стула»."
          : "Например: «Комната 4 на 3»."}
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
            {analyzing ? "Анализируем пожелания" : isBusy && buttonLabel}
          </span>
          <p className='support-text'>
            {props.wishes
              ? "После записи проверьте текст. При анализе GigaChat учтёт мебель и её положение на плане."
              : "Можно поправить текст после распознавания."}
          </p>
        </>
      ) : (
        <p className='notice'>
          Запись с микрофона недоступна. Можно ввести текст или использовать диктовку клавиатуры.
        </p>
      )}
      <Field className='mt-3' label={props.wishes ? "Пожелания к мебели" : "Размеры комнаты"}>
        <textarea
          rows={4}
          value={phrase}
          readOnly={isBusy}
          onChange={changePhrase}
          maxLength={4000}
          placeholder={props.wishes ? "Что добавить, заменить или переставить?" : "Комната 4 на 3…"}
        />
      </Field>
      {isDraft && <p className='support-text'>Черновик распознавания</p>}
      {message && (
        <p className='form-error' role='alert'>
          {message}
        </p>
      )}
      {analysis && (
        <div className='notice grid gap-2' role='status'>
          <p>{analysis.summary}</p>
          {analysis.budget !== undefined && <p>Бюджет проекта {money(analysis.budget)}</p>}
          {analysis.wishes.length > 0 && (
            <ul>
              {analysis.wishes.map((wish, index) => (
                <li key={`${wish.name}-${index}`}>
                  {wish.name} · {wish.quantity} шт.
                  {wish.material && ` · ${wish.material}`}
                  {wish.maxUnit !== undefined && ` · до ${money(wish.maxUnit)} за шт.`}
                  {wish.maxTotal !== undefined && ` · до ${money(wish.maxTotal)} за позицию`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!props.wishes && notes.length > 0 && (
        <div className='check-list'>
          {notes.map((note) => (
            <div key={note}>
              <Icon name='checkCircle' size={17} />
              {note}
            </div>
          ))}
        </div>
      )}
      <div className='form-actions'>
        {props.wishes && !analysis && (
          <Button icon='spark' className='primary' disabled={!phrase.trim() || isBusy} onClick={analyze}>
            {analyzing ? "Анализируем…" : "Проанализировать пожелания"}
          </Button>
        )}
        {props.wishes && analysis && (
          <Button icon='check' className='primary' disabled={isBusy} onClick={saveAnalysis}>
            Сохранить пожелания
          </Button>
        )}
        {!props.wishes && (
          <Button icon='check' className='primary' disabled={!notes.length || isBusy} onClick={applyVoice}>
            {hasPurchase ? "Проверить условия подбора" : "Применить"}
          </Button>
        )}
      </div>
    </>
  );
};
