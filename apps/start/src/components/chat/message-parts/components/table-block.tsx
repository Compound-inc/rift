"use client";

import type {
  ComponentProps,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { Button } from "@rift/ui/button";
import { cn } from "@rift/utils";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExpandIcon,
  MinimizeIcon,
} from "lucide-react";
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type TableBlockProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

interface TableBlockContextValue {
  rootRef: React.RefObject<HTMLDivElement | null>;
  tableRef: React.RefObject<HTMLTableElement | null>;
  isFullscreen: boolean;
  label: string;
  toggleFullscreen: () => void;
}

const TableBlockContext = createContext<TableBlockContextValue>({
  rootRef: { current: null },
  tableRef: { current: null },
  isFullscreen: false,
  label: "Table",
  toggleFullscreen: () => {},
});

function getDataRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const head = table.tHead ? Array.from(table.tHead.rows) : [];
  const body = Array.from(table.tBodies).flatMap((t) => Array.from(t.rows));
  return [...head, ...body];
}

function tableToTsv(table: HTMLTableElement): string {
  const rows = getDataRows(table);

  return rows
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .join("\t")
    )
    .join("\n")
    .trim();
}

function tableToCsv(table: HTMLTableElement): string {
  const rows = getDataRows(table);

  const escapeCsv = (value: string): string => {
    const escaped = value.replaceAll('"', '""');
    return `"${escaped}"`;
  };

  return rows
    .map((row) =>
      Array.from(row.cells)
        .map((cell) =>
          escapeCsv(cell.textContent?.replace(/\s+/g, " ").trim() ?? "")
        )
        .join(",")
    )
    .join("\n");
}

export const TableBlockContainer = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function TableBlockContainer({ className, style, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "group relative w-full overflow-visible rounded-lg border border-border-base/80 bg-surface-overlay text-foreground-strong",
        className
      )}
      style={{
        ...style,
      }}
      {...props}
    />
  );
});

type TableBlockTableProps = HTMLAttributes<HTMLTableElement> & {
  footer?: ReactNode;
};

export const TableBlockTable = ({
  children,
  className,
  footer,
  ...props
}: TableBlockTableProps) => {
  const { tableRef } = useContext(TableBlockContext);
  const hasFooter = Boolean(footer);

  return (
    <div className="relative overflow-auto">
      <table
        ref={tableRef}
        className={cn(
          "w-full border-separate border-spacing-0 overflow-hidden rounded-md text-start text-sm",
          "[&_thead_th:first-child]:rounded-tl-md [&_thead_th:last-child]:rounded-tr-md",
          hasFooter
            ? "[&_tbody_tr:last-child_td]:rounded-none"
            : "[&_tbody_tr:last-child_td:first-child]:rounded-bl-md [&_tbody_tr:last-child_td:last-child]:rounded-br-md",
          "[&_tbody_tr:nth-child(even)]:bg-surface-base/60",
          "[&_td]:border-border-base/60 [&_td]:border-b [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:text-foreground-primary",
          "[&_th]:border-border-base/70 [&_th]:border-b [&_th]:bg-surface-strong/85 [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-foreground-strong",
          "[&_tfoot_td]:border-t [&_tfoot_td]:border-border-base/80 [&_tfoot_td]:bg-surface-strong/85 [&_tfoot_td]:py-1 [&_tfoot_td]:align-middle [&_tfoot_td:first-child]:rounded-bl-md [&_tfoot_td:last-child]:rounded-br-md",
          className
        )}
        {...props}
      >
        {children}
        {hasFooter && (
          <tfoot>
            <tr>
              <td colSpan={999} className="px-1">
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export const TableBlock = ({
  className,
  children,
  label = "Table",
  ...props
}: TableBlockProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((current) => !current);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const contextValue = useMemo(
    () => ({
      rootRef,
      tableRef,
      isFullscreen,
      label,
      toggleFullscreen,
    }),
    [isFullscreen, label, toggleFullscreen]
  );

  const childArray = Children.toArray(children);
  const floatingControls = childArray.find(
    (child): child is ReactElement =>
      (child as ReactElement)?.type === TableBlockFloatingControls
  );
  const tableContent = childArray.filter(
    (child) => (child as ReactElement)?.type !== TableBlockFloatingControls
  );

  type ControlsProps = { variant: "inline" | "fullscreen" };
  const controlsInline =
    floatingControls &&
    typeof floatingControls === "object" &&
    "type" in floatingControls
      ? cloneElement(
          floatingControls as ReactElement<ControlsProps>,
          { key: "inline", variant: "inline" as const }
        )
      : null;
  const controlsFullscreen =
    floatingControls &&
    typeof floatingControls === "object" &&
    "type" in floatingControls
      ? cloneElement(
          floatingControls as ReactElement<ControlsProps>,
          { key: "fullscreen", variant: "fullscreen" as const }
        )
      : null;

  const tableWithFooter = (footerSlot: ReactNode) =>
    Children.map(tableContent, (child) =>
      (child as ReactElement)?.type === TableBlockTable
        ? cloneElement(child as ReactElement<{ footer?: ReactNode }>, {
            footer: footerSlot,
          })
        : child
    );

  return (
    <TableBlockContext.Provider value={contextValue}>
      <TableBlockContainer
        ref={isFullscreen ? undefined : rootRef}
        className={className}
        {...props}
      >
        {tableWithFooter(controlsInline)}
      </TableBlockContainer>
      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[110] overflow-auto p-4">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black/60"
              onClick={toggleFullscreen}
            />
            <div className="pointer-events-none relative z-10 flex min-h-full items-center justify-center">
              <TableBlockContainer
                ref={rootRef}
                className={cn(
                  className,
                  "pointer-events-auto !m-0 h-auto max-h-[calc(100vh-2rem)] w-full max-w-[min(1200px,calc(100vw-2rem))] overflow-auto shadow-2xl"
                )}
                role="dialog"
                aria-label={`${label} fullscreen`}
                aria-modal="true"
                {...props}
              >
                {tableWithFooter(controlsFullscreen)}
              </TableBlockContainer>
            </div>
          </div>,
          document.body
        )}
    </TableBlockContext.Provider>
  );
};

export const TableBlockFloatingControls = ({
  children,
  className,
  variant = "inline",
}: {
  children: ReactNode;
  className?: string;
  variant?: "inline" | "fullscreen";
}) => {
  const { isFullscreen } = useContext(TableBlockContext);

  const isActive =
    (variant === "inline" && !isFullscreen) ||
    (variant === "fullscreen" && isFullscreen);
  if (!isActive) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2.5",
        className
      )}
    >
      {children}
    </div>
  );
};

export type TableBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const TableBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: TableBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { tableRef } = useContext(TableBlockContext);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    const table = tableRef.current;
    if (!table) {
      onError?.(new Error("Table element not available"));
      return;
    }

    const tsv = tableToTsv(table);
    if (!tsv) return;

    try {
      if (!isCopied) {
        await navigator.clipboard.writeText(tsv);
        setIsCopied(true);
        onCopy?.();
        timeoutRef.current = window.setTimeout(() => setIsCopied(false), timeout);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [isCopied, onCopy, onError, tableRef, timeout]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn(
        "h-7 w-7 shrink-0 rounded-md border border-transparent p-1.5 text-foreground-tertiary transition-colors duration-100 hover:bg-surface-raised hover:text-foreground-primary focus-visible:border-border-base focus-visible:ring-0",
        className
      )}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};

export type TableBlockFullscreenButtonProps = ComponentProps<typeof Button>;

export const TableBlockFullscreenButton = ({
  className,
  ...props
}: TableBlockFullscreenButtonProps) => {
  const { isFullscreen, toggleFullscreen } = useContext(TableBlockContext);
  const Icon = isFullscreen ? MinimizeIcon : ExpandIcon;

  return (
    <Button
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      className={cn(
        "h-7 w-7 shrink-0 rounded-md border border-transparent p-1.5 text-foreground-tertiary transition-colors duration-100 hover:bg-surface-raised hover:text-foreground-primary focus-visible:border-border-base focus-visible:ring-0",
        className
      )}
      onClick={toggleFullscreen}
      size="icon"
      variant="ghost"
      {...props}
    >
      <Icon size={14} />
    </Button>
  );
};

export type TableBlockDownloadButtonProps = ComponentProps<typeof Button> & {
  filename?: string;
  onError?: (error: Error) => void;
};

export const TableBlockDownloadButton = ({
  className,
  filename = "table.csv",
  onError,
  children,
  ...props
}: TableBlockDownloadButtonProps) => {
  const { tableRef } = useContext(TableBlockContext);

  const download = useCallback(() => {
    const table = tableRef.current;
    if (!table) {
      onError?.(new Error("Table element not available"));
      return;
    }

    try {
      const csv = tableToCsv(table);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [filename, onError, tableRef]);

  return (
    <Button
      className={cn(
        "h-7 w-7 shrink-0 rounded-md border border-transparent p-1.5 text-foreground-tertiary transition-colors duration-100 hover:bg-surface-raised hover:text-foreground-primary focus-visible:border-border-base focus-visible:ring-0",
        className
      )}
      onClick={download}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <DownloadIcon size={14} />}
    </Button>
  );
};
