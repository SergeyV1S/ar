import { Icon } from "../../../shared/components/index.ts";
import { useImagePicker } from "../hooks/index.ts";

export type ImagePickerProps = {
  onPhoto: (photo: string) => void;
  label?: string;
  camera?: boolean;
};

export const ImagePicker = (props: ImagePickerProps) => {
  const { label = "Добавить фото", camera = true } = props;
  const { error, load } = useImagePicker(props);
  return (
    <div className='flex flex-wrap gap-2 mt-1.5 mr-0 mb-3 ml-0'>
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
      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};
