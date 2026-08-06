export interface GestionProcessOptions<T> {
  items: readonly T[];
  search?: string;
  searchAccessor?: (item: T) => string;
  sortBy?: keyof T | null;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface GestionProcessResult<T> {
  items: readonly T[];
  filteredItems: readonly T[];
  totalItems: number;
  totalFilteredItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

function normalizeText(
  value: unknown,
): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

function compareValues(
  left: unknown,
  right: unknown,
): number {
  if (
    typeof left === "number" &&
    typeof right === "number"
  ) {
    return left - right;
  }

  const leftDate = Date.parse(String(left));
  const rightDate = Date.parse(String(right));

  if (
    !Number.isNaN(leftDate) &&
    !Number.isNaN(rightDate)
  ) {
    return leftDate - rightDate;
  }

  return String(left ?? "").localeCompare(
    String(right ?? ""),
    "es",
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

export function processGestionItems<T>(
  options: GestionProcessOptions<T>,
): GestionProcessResult<T> {
  const {
    items,
    search = "",
    searchAccessor = (item) =>
      JSON.stringify(item),
    sortBy = null,
    sortDirection = "asc",
    page = 1,
    pageSize = 25,
  } = options;

  const normalizedSearch =
    normalizeText(search);

  const filteredItems =
    normalizedSearch.length === 0
      ? [...items]
      : items.filter((item) =>
          normalizeText(
            searchAccessor(item),
          ).includes(normalizedSearch),
        );

  const sortedItems = [...filteredItems];

  if (sortBy !== null) {
    sortedItems.sort((left, right) => {
      const comparison = compareValues(
        left[sortBy],
        right[sortBy],
      );

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }

  const safePageSize =
    Math.max(1, pageSize);

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedItems.length / safePageSize,
    ),
  );

  const safePage = Math.min(
    Math.max(1, page),
    totalPages,
  );

  const start =
    (safePage - 1) * safePageSize;

  const paginatedItems =
    sortedItems.slice(
      start,
      start + safePageSize,
    );

  return {
    items: paginatedItems,
    filteredItems: sortedItems,
    totalItems: items.length,
    totalFilteredItems:
      sortedItems.length,
    totalPages,
    page: safePage,
    pageSize: safePageSize,
  };
}

export function calculateGestionTotals<T>(
  items: readonly T[],
  selectors: Readonly<
    Record<
      string,
      (item: T) => number
    >
  >,
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(selectors).map(
      ([key, selector]) => [
        key,
        items.reduce(
          (total, item) =>
            total + selector(item),
          0,
        ),
      ],
    ),
  );
}
