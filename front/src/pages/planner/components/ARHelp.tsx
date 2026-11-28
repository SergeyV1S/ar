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
          ? "Отметьте первый угол у пола. Наведите камеру на следующий угол: появится стена с её длиной. Закрепите стены по периметру и замкните контур. Затем можно отметить проёмы и расставить мебель прямо в AR."
          : "Отметьте на полу начало плана и направление верхней стены. Мебель появится в масштабе 1:1 с тенями и подложкой пола. Модель можно повернуть кнопкой или переставить, отметив точки заново."}
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
