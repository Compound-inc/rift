import { cn } from "@rift/utils";
import type React from "react";
 
function Root({ className, ...props }: React.ComponentPropsWithRef<"div">) {
	return (
		<div
			className={cn(
				"grid [grid-template-areas:'stack'] justify-items-center",
				className,
			)}
			{...props}
		/>
	);
}
 
function Card({
	className,
	innerClassName,
	index,
	gapX = 8,
	gapY = 6,
	children,
}: {
	className?: string;
	innerClassName?: string;
	x?: number;
	y?: number;
	index: number;
	gapX?: number;
	gapY?: number;
	children?: React.ReactNode;
}) {
	return (
		<div
			style={
				{
					"--x": `calc(var(--spacing) * ${index} * ${gapX})`,
					"--y": `calc(var(--spacing) * ${index} * ${gapY})`,
				} as React.CSSProperties
			}
			className={cn(
				"group [grid-area:stack] ",
				"translate-x-(--x) translate-y-(--y)",
				className,
			)}
		>
			<div
				tabIndex={0}
				className={cn(
					"focus:-translate-y-12 group-hover:-translate-y-12 transition duration-500 ease-in-out rounded-md border-2 border-black/5 -skew-y-6 backdrop-blur-sm relative after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:bg-linear-to-r after:from-white/50 after:to-transparent after:pointer-events-none",
					innerClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}
 
export const LightWeightCards = {
	Root,
	Card,
};