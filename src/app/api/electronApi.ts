export type ElectronApi = NonNullable<Window['carteraApi']>;

export function getElectronApi(): ElectronApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.api ?? window.carteraApi ?? null;
}
