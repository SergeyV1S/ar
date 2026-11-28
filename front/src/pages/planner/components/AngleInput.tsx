import type { ChangeEvent } from "react";

type AngleInputProps = {
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const AngleInput = ({ value, onChange }: AngleInputProps) => {
  const degree = Math.round(value) % 360;
  return (
    <label className='angle-input'>
      <span>Поворот</span>
      <input
        type='range'
        min='0'
        max='359'
        value={degree}
        onChange={onChange}
        aria-valuetext={`${degree}°`}
      />
      <output>{degree}°</output>
    </label>
  );
};
