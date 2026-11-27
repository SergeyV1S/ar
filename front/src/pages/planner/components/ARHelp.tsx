import { Button, Icon } from "../../../shared/components/index.ts";
import { getARAvailabilityMessage } from "../helpers/index.ts";

export const ARHelp = ({
  mode,
  support,
  error,
  back,
  launch
}: {
  mode: string;
  support: boolean | null;
  error: string;
  back: () => void;
  launch: () => void;
}) => {
  const scan = mode === "scan";
  return (
    <>
      <p className='support-text'>
        {scan
          ? "Наведите камеру на пол и отметьте углы комнаты последовательно. Затем можно отметить края проёмов и розетки. Габариты будут рассчитаны по измеренным точкам."
          : "Отметьте на полу начало плана и направление верхней стены. Расставленная мебель появится в масштабе 1:1. Для перестановки модели отметьте точки заново."}
      </p>
      <div className='notice'>
        <Icon name='info' />
        {getARAvailabilityMessage(support)}
      </div>
      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
      <div className='form-actions'>
        {scan ? (
          <Button icon='camera' onClick={back}>
            Ручная разметка
          </Button>
        ) : (
          <Button onClick={back}>Вернуться к плану</Button>
        )}
        <Button
          className='primary'
          icon={scan ? "scan" : "cube"}
          disabled={support !== true}
          onClick={launch}
        >
          {scan ? "Запустить обмер" : "Запустить AR-просмотр"}
        </Button>
      </div>
    </>
  );
};
