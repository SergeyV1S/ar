import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const icons: Record<string, string> = {
  brand: "M4 16V5h10M9 16v-6h8v6m3-7v7h-3M4 20h8M20 5h.01",
  layout: "M3.5 4h17v16h-17zM3.5 9h17m-10 0v11",
  grid: "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z",
  receipt: "M6 3l3 2 3-2 3 2 3-2v18l-3-2-3 2-3-2-3 2zM9 9h6m-6 4h6",
  shield: "M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10zm-3-10 2 2 4-4",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  chevron: "m9 6 6 6-6 6",
  down: "m6 9 6 6 6-6",
  download: "M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4",
  spark: "M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2zm7 13v6m-3-3h6M5 3v4M3 5h4",
  sliders: "M4 6h8m4 0h4M4 12h3m4 0h9M4 18h10m4 0h2M12 3v6m-5 0v6m7 0v6",
  pencil: "m4 15 11-11 4 4L8 19l-5 1zM13 6l4 4",
  ruler: "M3 20v-7L15 2l6 6L9 20zM8 11l3 3m0-6 3 3m0-6 3 3",
  scan: "M8 4H5a1 1 0 0 0-1 1v3m12-4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m8 0h3a1 1 0 0 0 1-1v-3M3 12h18m-14-2v4m10-4v4",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zm-3 6v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6",
  stop: "M7 7h10v10H7z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  cube: "m12 3 9 5v8l-9 5-9-5V8zm-9 5 9 5 9-5m-9 5v8",
  layers: "m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5m-18 4 9 5 9-5",
  expand: "M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5",
  bag: "M5 8h14l1 13H4zm4 2V6a3 3 0 0 1 6 0v4",
  check: "m5 12 4 4L19 6",
  checkCircle: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM7.5 12l3 3 6-6",
  alert:
    "M10.5 4.2a1.7 1.7 0 0 1 3 0l7.2 13a1.7 1.7 0 0 1-1.5 2.5H4.8a1.7 1.7 0 0 1-1.5-2.5zM12 9v4m0 3h.01",
  table: "M3 8h18v3H3zm2 3v9m14-9v9",
  cabinet: "M4 4h16v15H4zm8 0v15M6 19v2m12-2v2M9 10v3m6-3v3",
  sofa: "M6 12v-2a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2m-12 6v2m12-2v2M4 12a2 2 0 0 1 2 2v1h12v-1a2 2 0 1 1 4 0v4H2v-4a2 2 0 0 1 2-2z",
  chair: "M7 13V8a5 5 0 0 1 10 0v5m-10 6-1 2m11-2 1 2M5 16a2 2 0 1 1 4 0h6a2 2 0 1 1 4 0v3H5z",
  external: "M13 5h6v6m0-6-8 8m6 1v5H5V7h5",
  more: "M5 12h.01m7 0h.01m7 0h.01",
  close: "m6 6 12 12M18 6 6 18",
  rotate: "M4 10a8 8 0 1 1 1 8m-1-8V4m0 6h6",
  door: "M4 21h16m-3 0V3H7v18m7-9h.01",
  window: "M4 4h16v16H4zM12 4v16m-8-8h16",
  socket: "M6 7h12v10H6zm4 4v2m4-2v2",
  camera: "M4 7h4l2-3h4l2 3h4v13H4zm12 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  upload: "M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4",
  trash: "M4 6h16m-14 0 1 14h10l1-14M9 6V3h6v3m-5 3v7m4-7v7",
  lock: "M6 10h12v11H6zm2 0V7a4 4 0 0 1 8 0v3m-4 5v2",
  printer: "M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7zm9-3h.01",
  info: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zm-10-1v6m0-10h.01"
};

export const Icon = ({
  name,
  size = 18,
  className = ""
}: {
  name: string;
  size?: number;
  className?: string;
}) => {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={name === "more" ? 3.2 : 1.65}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d={icons[name] ?? icons.cube} />
    </svg>
  );
};

export const Button = ({
  icon,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }) => {
  return (
    <button type='button' className={`btn ${className}`} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
};

export const IconButton = ({
  icon,
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) => {
  return (
    <button
      type='button'
      className={`icon-btn ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
};

export const Field = ({
  label,
  children,
  hint,
  className = ""
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) => {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
};

export const Select = ({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => {
  return (
    <span className='select'>
      <select {...props}>{children}</select>
      <Icon name='down' size={15} />
    </span>
  );
};
