import type {
  CSSProperties,
  MouseEventHandler,
  ReactNode,
} from "react";

export interface GestionChildrenProps {
  children: ReactNode;
}

export interface GestionSectionTitleProps {
  icon: string;
  title: string;
  subtitle: string;
  className?: string;
}

export type GestionKpiTone =
  | "primary"
  | "danger"
  | "success"
  | "violet";

export interface GestionKpiCardProps {
  label: ReactNode;
  value: ReactNode;
  tone?: GestionKpiTone;
  negative?: boolean;
}

export interface GestionClientRowProps {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLTableRowElement>;
  style?: CSSProperties;
  title?: string;
}
