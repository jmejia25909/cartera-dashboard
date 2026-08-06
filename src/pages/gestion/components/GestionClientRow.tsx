import type { GestionClientRowProps } from "../types";

export function GestionClientRow({
  children,
  className,
  onClick,
  style,
  title,
}: GestionClientRowProps) {
  return (
    <tr
      className={className}
      onClick={onClick}
      style={style}
      title={title}
    >
      {children}
    </tr>
  );
}
