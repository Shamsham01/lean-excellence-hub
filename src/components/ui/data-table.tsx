"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
};

type SortState = {
  columnId: string;
  direction: "asc" | "desc";
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  searchPlaceholder = "Search…",
  searchFilter,
  pageSizeOptions = [5, 10, 25],
  defaultPageSize = 10,
  emptyState,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  emptyState?: ReactNode;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState | null>(null);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    const predicate =
      searchFilter ??
      ((row: T, q: string) => JSON.stringify(row).toLowerCase().includes(q));
    return rows.filter((row) => predicate(row, trimmed));
  }, [query, rows, searchFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (left === right) return 0;
      if (typeof left === "number" && typeof right === "number") {
        return sort.direction === "asc" ? left - right : right - left;
      }
      const text = String(left).localeCompare(String(right));
      return sort.direction === "asc" ? text : -text;
    });
    return copy;
  }, [columns, filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = sorted.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );

  function toggleSort(columnId: string, sortable: boolean) {
    if (!sortable) return;
    setSort((current) => {
      if (current?.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { columnId, direction: "desc" };
      }
      return null;
    });
  }

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Show
          <Select
            aria-label="Rows per page"
            className="mx-2 inline-block w-auto min-w-16"
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
          entries
        </div>
        <Input
          type="search"
          value={query}
          placeholder={searchPlaceholder}
          className="w-full sm:max-w-xs"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          aria-label="Search table"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const active = sort?.columnId === column.id;
              return (
                <TableHead key={column.id} className={column.className}>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1",
                      sortable && "cursor-pointer hover:text-foreground",
                    )}
                    disabled={!sortable}
                    onClick={() => toggleSort(column.id, sortable)}
                  >
                    {column.header}
                    {sortable ? (
                      active ? (
                        sort?.direction === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown
                          className="size-3.5 opacity-50"
                          aria-hidden
                        />
                      )
                    ) : null}
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                {emptyState ?? (
                  <span className="text-sm text-muted-foreground">
                    No results
                  </span>
                )}
              </TableCell>
            </TableRow>
          ) : (
            paged.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {sorted.length === 0 ? 0 : safePage * pageSize + 1}–
          {Math.min(sorted.length, safePage * pageSize + pageSize)} of{" "}
          {sorted.length}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
