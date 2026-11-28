import { Icon, IconButton } from "../../../shared/components/index.ts";
import { useImagePicker } from "../hooks/index.ts";

export type ImagePickerProps = {
  onPhoto: (photo: string) => void;
  label?: string;
  camera?: boolean;
  popover?: boolean;
};

export const ImagePicker = (props: ImagePickerProps) => {
  const { label = "Добавить фото", camera = true, popover } = props;
  const { error, load, picker, pickerId } = useImagePicker(props);
  const actions = (
    <>
      <label className='btn file-btn'>
        <Icon name='upload' />
        {label}
        <input type='file' accept='image/*' onChange={load} />
      </label>
      {camera && (
        <label className='btn file-btn'>
          <Icon name='camera' />
          Камера
          <input type='file' accept='image/*' capture='environment' onChange={load} />
        </label>
      )}
    </>
  );
  return (
    <div className={popover ? "contents" : "flex flex-wrap gap-2 mt-1.5 mb-3"}>
      {popover ? (
        <>
          <IconButton icon='more' label='Источники плана' popoverTarget={pickerId} />
          <div className='image-picker-popover' popover='auto' ref={picker} id={pickerId}>
            {actions}
          </div>
        </>
      ) : actions}
      {error && (
        <p className='form-error basis-full' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};
