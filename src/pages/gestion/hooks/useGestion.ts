import { useMemo } from "react";

import {
  processGestionItems,
  type GestionProcessResult,
} from "../services";

import {
  useGestionViewState,
  type GestionViewState,
} from "./useGestionViewState";

export interface UseGestionOptions<T> {
  items: readonly T[];
  searchAccessor?: (item: T) => string;
  initialPage?: number;
  initialPageSize?: number;
  initialSearch?: string;
}

export interface GestionController<T> {
  view: GestionViewState;
  result: GestionProcessResult<T>;
  visibleIds: readonly string[];
}

export function useGestion<T extends Record<string, unknown>>(
  options: UseGestionOptions<T>,
): GestionController<T> {
  const {
    items,
    searchAccessor,
    initialPage,
    initialPageSize,
    initialSearch,
  } = options;

  const view = useGestionViewState({
    initialPage,
    initialPageSize,
    initialSearch,
  });

  const result = useMemo(
    () =>
      processGestionItems({
        items,
        search: view.search,
        searchAccessor,
        sortBy: view.sortBy as keyof T | null,
        sortDirection: view.sortDirection,
        page: view.page,
        pageSize: view.pageSize,
      }),
    [
      items,
      searchAccessor,
      view.page,
      view.pageSize,
      view.search,
      view.sortBy,
      view.sortDirection,
    ],
  );

  const visibleIds = useMemo(
    () =>
      result.items.map((item, index) =>
        String(
          item.id ??
            item.codigo ??
            item.identificacion ??
            index,
        ),
      ),
    [result.items],
  );

  return useMemo(
    () => ({
      view,
      result,
      visibleIds,
    }),
    [
      result,
      view,
      visibleIds,
    ],
  );
}
