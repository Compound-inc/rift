"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Columns3, Search } from "lucide-react"

import { cn } from "@rift/utils"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Input } from "./input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"

export type DataTableMessages = {
  filterPlaceholder?: string
  columns?: string
  loading?: string
  noResults?: string
  rowsSelected?: string
  previous?: string
  next?: string
}

export type DataTableProps<TData, TValue> = {
  columns: Array<ColumnDef<TData, TValue>>
  data: Array<TData>
  isLoading?: boolean
  filterColumn?: string
  filterPlaceholder?: string
  toolbarActionsRight?: React.ReactNode
  showColumnToggle?: boolean
  initialColumnVisibility?: VisibilityState
  pageSize?: number
  className?: string
  tableWrapperClassName?: string
  messages?: DataTableMessages
}

export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<
  TData,
  TValue
>

const defaultMessages: Required<DataTableMessages> = {
  filterPlaceholder: "Filter...",
  columns: "Columns",
  loading: "Loading...",
  noResults: "No results.",
  rowsSelected: "row(s) selected.",
  previous: "Previous",
  next: "Next",
}

/**
 * Generic data table with common UX primitives:
 * filtering, column visibility toggles, row selection, and pagination.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  filterColumn,
  filterPlaceholder,
  toolbarActionsRight,
  showColumnToggle = true,
  initialColumnVisibility,
  pageSize = 10,
  className,
  tableWrapperClassName,
  messages,
}: DataTableProps<TData, TValue>) {
  const copy = React.useMemo(
    () => ({ ...defaultMessages, ...messages }),
    [messages],
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialColumnVisibility ?? {},
  )
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data,
    columns,
    initialState: { pagination: { pageSize } },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          {filterColumn && (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-content-subtle" />
              <Input
                value={
                  (table.getColumn(filterColumn)?.getFilterValue() as string) ??
                  ""
                }
                onChange={(event) =>
                  table
                    .getColumn(filterColumn)
                    ?.setFilterValue(event.target.value)
                }
                placeholder={filterPlaceholder ?? copy.filterPlaceholder}
                className="pl-8"
              />
            </div>
          )}

          {showColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="default">
                  <Columns3 className="size-4" aria-hidden />
                  {copy.columns}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id.replaceAll("_", " ")}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {toolbarActionsRight}
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border-muted bg-bg-default",
          tableWrapperClassName,
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {copy.loading}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {copy.noResults}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-content-muted">
          {table.getFilteredSelectedRowModel().rows.length} {copy.rowsSelected}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="default"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" aria-hidden />
            {copy.previous}
          </Button>
          <Button
            variant="ghost"
            size="default"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {copy.next}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
