import type {
  MouseEventHandler,
  ReactNode,
} from "react";

interface GestionClientRowProps {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLTableRowElement>;
  style?: React.CSSProperties;
  title?: string;
}

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
