import {
  useCallback,
  useMemo,
  useState,
} from "react";

export type GestionSortDirection =
  | "asc"
  | "desc";

export interface GestionViewStateOptions {
  initialSearch?: string;
  initialPage?: number;
  initialPageSize?: number;
}

export interface GestionViewState {
  search: string;
  page: number;
  pageSize: number;
  selectedIds: ReadonlySet<string>;
  sortBy: string | null;
  sortDirection: GestionSortDirection;
  setSearch: (value: string) => void;
  setPage: (value: number) => void;
  setPageSize: (value: number) => void;
  setSort: (
    field: string,
    direction?: GestionSortDirection,
  ) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: readonly string[]) => void;
  resetView: () => void;
}

export function useGestionViewState(
  options: GestionViewStateOptions = {},
): GestionViewState {
  const {
    initialSearch = "",
    initialPage = 1,
    initialPageSize = 25,
  } = options;

  const [search, setSearchState] = useState(
    initialSearch,
  );

  const [page, setPage] = useState(
    initialPage,
  );

  const [pageSize, setPageSizeState] = useState(
    initialPageSize,
  );

  const [selectedIds, setSelectedIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const [sortBy, setSortBy] = useState<
    string | null
  >(null);

  const [
    sortDirection,
    setSortDirection,
  ] = useState<GestionSortDirection>("asc");

  const setSearch = useCallback(
    (value: string): void => {
      setSearchState(value);
      setPage(1);
    },
    [],
  );

  const setPageSize = useCallback(
    (value: number): void => {
      setPageSizeState(
        Math.max(1, value),
      );
      setPage(1);
    },
    [],
  );

  const setSort = useCallback(
    (
      field: string,
      direction?: GestionSortDirection,
    ): void => {
      setSortBy((currentField) => {
        if (direction) {
          setSortDirection(direction);
          return field;
        }

        if (currentField === field) {
          setSortDirection((currentDirection) =>
            currentDirection === "asc"
              ? "desc"
              : "asc",
          );

          return field;
        }

        setSortDirection("asc");
        return field;
      });

      setPage(1);
    },
    [],
  );

  const toggleSelection = useCallback(
    (id: string): void => {
      setSelectedIds((current) => {
        const next = new Set(current);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      });
    },
    [],
  );

  const clearSelection = useCallback(
    (): void => {
      setSelectedIds(new Set());
    },
    [],
  );

  const selectAll = useCallback(
    (ids: readonly string[]): void => {
      setSelectedIds(
        new Set(ids),
      );
    },
    [],
  );

  const resetView = useCallback(
    (): void => {
      setSearchState(initialSearch);
      setPage(initialPage);
      setPageSizeState(initialPageSize);
      setSelectedIds(new Set());
      setSortBy(null);
      setSortDirection("asc");
    },
    [
      initialPage,
      initialPageSize,
      initialSearch,
    ],
  );

  return useMemo(
    () => ({
      search,
      page,
      pageSize,
      selectedIds,
      sortBy,
      sortDirection,
      setSearch,
      setPage,
      setPageSize,
      setSort,
      toggleSelection,
      clearSelection,
      selectAll,
      resetView,
    }),
    [
      clearSelection,
      page,
      pageSize,
      resetView,
      search,
      selectAll,
      selectedIds,
      setPageSize,
      setSearch,
      setSort,
      sortBy,
      sortDirection,
      toggleSelection,
    ],
  );
}
