"use client";

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
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
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  controlsVisible: boolean;
  showControls: () => void;
  hideControls: () => void;
  toggleFullscreen: () => void;
}

const TableBlockContext = createContext<TableBlockContextValue>({
  rootRef: { current: null },
  tableRef: { current: null },
  isFullscreen: false,
  label: "Table",
  controlsVisible: false,
  showControls: () => {},
  hideControls: () => {},
  toggleFullscreen: () => {},
});

/**
 * Converts a rendered HTML table to TSV so users can paste into spreadsheets.
 * We normalize whitespace to avoid copying formatting artifacts from nested markup.
 */
function tableToTsv(table: HTMLTableElement): string {
  const rows = Array.from(table.rows);

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
  const rows = Array.from(table.rows);

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
        "group relative w-full overflow-visible rounded-lg border border-border-default/80 bg-bg-subtle text-content-emphasis",
        className
      )}
      style={{
        containIntrinsicSize: "auto 220px",
        contentVisibility: "auto",
        ...style,
      }}
      {...props}
    />
  );
});

/**
 * Styled semantic table container used by Streamdown's `table` component override.
 */
export const TableBlockTable = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableElement>) => {
  const { tableRef } = useContext(TableBlockContext);

  return (
    <div className="relative overflow-auto">
      <table
        ref={tableRef}
        className={cn(
          "w-full border-separate border-spacing-0 overflow-hidden rounded-md text-left text-sm",
          "[&_thead_th:first-child]:rounded-tl-md [&_thead_th:last-child]:rounded-tr-md",
          "[&_tbody_tr:last-child_td:first-child]:rounded-bl-md [&_tbody_tr:last-child_td:last-child]:rounded-br-md",
          "[&_tbody_tr:nth-child(even)]:bg-bg-default/60",
          "[&_td]:border-border-default/60 [&_td]:border-b [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:text-content-default",
          "[&_th]:border-border-default/70 [&_th]:border-b [&_th]:bg-bg-emphasis/85 [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-content-emphasis",
          className
        )}
        {...props}
      >
        {children}
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
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimeoutRef = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((current) => !current);
  }, []);

  const clearHideTimeout = useCallback(() => {
    window.clearTimeout(hideTimeoutRef.current);
  }, []);

  const showControls = useCallback(() => {
    clearHideTimeout();
    setControlsVisible(true);
  }, [clearHideTimeout]);

  const hideControls = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 90);
  }, [clearHideTimeout]);

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

  useEffect(
    () => () => {
      window.clearTimeout(hideTimeoutRef.current);
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      rootRef,
      tableRef,
      isFullscreen,
      label,
      controlsVisible,
      showControls,
      hideControls,
      toggleFullscreen,
    }),
    [
      isFullscreen,
      label,
      controlsVisible,
      showControls,
      hideControls,
      toggleFullscreen,
    ]
  );

  const content = <>{children}</>;

  return (
    <TableBlockContext.Provider value={contextValue}>
      {isFullscreen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-auto p-4">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-black/60"
                onClick={toggleFullscreen}
              />
              <TableBlockContainer
                ref={rootRef}
                className={cn(
                  className,
                  "relative z-10 !m-0 h-auto max-h-[calc(100vh-2rem)] w-full max-w-[min(1200px,calc(100vw-2rem))] overflow-auto shadow-2xl"
                )}
                onMouseEnter={showControls}
                onMouseLeave={hideControls}
                onFocusCapture={showControls}
                onBlurCapture={hideControls}
                role="dialog"
                aria-label={`${label} fullscreen`}
                aria-modal="true"
                {...props}
              >
                {content}
              </TableBlockContainer>
            </div>,
            document.body
          )
        : (
          <TableBlockContainer
            ref={rootRef}
            className={className}
            onMouseEnter={showControls}
            onMouseLeave={hideControls}
            onFocusCapture={showControls}
            onBlurCapture={hideControls}
            {...props}
          >
            {content}
          </TableBlockContainer>
        )}
    </TableBlockContext.Provider>
  );
};

type FloatingPosition = {
  top: number;
  left: number;
};

export const TableBlockFloatingControls = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { rootRef, controlsVisible, showControls, hideControls } =
    useContext(TableBlockContext);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  const updatePosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      setPosition(null);
      return;
    }

    const rect = root.getBoundingClientRect();
    const left = Math.max(8, rect.left - 44);
    const top = Math.max(8, rect.top + 8);
    setPosition({ top, left });
  }, [rootRef]);

  useLayoutEffect(() => {
    if (!controlsVisible) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [controlsVisible, updatePosition]);

  if (!controlsVisible || !position || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed z-[140] flex flex-col items-center gap-1 rounded-md border border-border-default bg-bg-subtle/95 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-bg-subtle/80",
        className
      )}
      onMouseEnter={showControls}
      onMouseLeave={hideControls}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {children}
    </div>,
    document.body
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
      className={cn("shrink-0", className)}
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
      className={cn("shrink-0", className)}
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
      className={cn("shrink-0", className)}
      onClick={download}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <DownloadIcon size={14} />}
    </Button>
  );
};
