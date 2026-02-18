/**
 * Re-exports the shared Spinner primitive from @rift/ui.
 * Use Loader (this) for backward compatibility, or import Spinner from "@rift/ui/spinner" directly.
 */
import * as React from "react";
import { Spinner } from "@rift/ui/spinner";

export type LoaderProps = React.ComponentProps<typeof Spinner>;

export const Loader = Spinner;
