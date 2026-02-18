"use client";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import type { CheckoutParams, CheckoutResult, ProductItem } from "autumn-js";
import { ArrowRight, Check, ChevronDown, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
} from "@/components/ui/accordion";
import { Button } from "@rift/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "@rift/ui/dialog";
import { Input } from "@rift/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@rift/ui/popover";
import { useCustomer } from "autumn-js/react";
import { cn } from "@rift/utils";
import { getCheckoutContent } from "@/lib/autumn/checkout-content";
import { getSubscribeCheckoutUrl } from "@/actions/getSubscribeCheckoutUrl";

const CHECKOUT_CTA_CLASS =
	"hover:bg-white hover:text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] hover:shadow-[rgba(0,0,0,0.1)_0px_0px_0px_1px] relative flex w-full cursor-pointer select-none items-center justify-center whitespace-nowrap bg-white text-sm leading-4 tracking-normal duration-[0.17s] text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 shadow-[rgba(0,0,0,0.05)_0px_0px_0px_1px] rounded-[50px] h-10 border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed";

const TEXT_PRIMARY =
	"text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white";
const TEXT_MUTED =
	"text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.6)] dark:text-zinc-400";
const TEXT_SECONDARY =
	"text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.8)] dark:text-zinc-300";
const STROKE_MUTED =
	"stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white";

export interface CheckoutModalProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	checkoutResult: CheckoutResult;
	checkoutParams?: CheckoutParams;
}

const formatCurrency = ({
	amount,
	currency,
}: {
	amount: number;
	currency: string;
}) => {
	return new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: currency,
	}).format(amount);
};

const EN_MONTH_TO_ES: Record<string, string> = {
	Jan: "ene", Feb: "feb", Mar: "mar", Apr: "abr", May: "may", Jun: "jun",
	Jul: "jul", Aug: "ago", Sep: "sep", Oct: "oct", Nov: "nov", Dec: "dic",
};

function formatPlanName(name: string): string {
	const lower = name.toLowerCase();
	if (lower === "plus") return "Plus";
	if (lower === "pro") return "Pro";
	return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function translateBillingToSpanish(text: string | undefined): string {
	if (!text) return "";
	let out = text;
	Object.entries(EN_MONTH_TO_ES).forEach(([en, es]) => {
		out = out.replace(new RegExp(`\\b${en}\\b`, "g"), es);
	});
	out = out
		.replace(/\bper month\b/gi, "al mes")
		.replace(/\/ month\b/gi, "/ mes")
		.replace(/\bmonth\b/gi, "mes");
	out = out.replace(/\bUnused\s+\w+/gi, "Crédito a favor");
	out = out.replace(/\bfrom\s+(\d{1,2}\s+\w+\s+\d{4})/gi, "a partir del $1");
	out = out.replace(/\bfrom\s+/gi, "a partir del ");
	out = out.replace(/\s*\(\s*a partir del [^)]+\)/gi, "");
	out = out.replace(
		/^(\w+)\s*-\s*/,
		(_, name) => `${formatPlanName(name)} - `,
	);
	return out.trim();
}

function getGradientIdForProduct(productId: string): "1" | "2" | "3" {
	const lower = productId.toLowerCase();
	if (lower === "plus") return "1";
	if (lower === "pro") return "2";
	return "3";
}

function CheckoutGradientBackground({
	id,
	prefix = "cd",
}: {
	id: "1" | "2" | "3";
	prefix?: string;
}) {
	const gradients = {
		"1": (
			<>
				<rect width="300" height="300" fill={`url(#${prefix}paint0_radial_265)`} />
				<rect width="300" height="300" fill={`url(#${prefix}paint1_radial_265)`} />
				<rect width="300" height="300" fill={`url(#${prefix}paint2_radial_265)`} />
				<rect width="300" height="300" fill={`url(#${prefix}paint3_radial_265)`} />
				<defs>
					<radialGradient id={`${prefix}paint0_radial_265`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117 300) rotate(-90) scale(181)">
						<stop stopColor="#5767C2" stopOpacity="0.1" />
						<stop offset="1" stopColor="#5767C2" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={`${prefix}paint1_radial_265`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)">
						<stop stopColor="#FF6D2E" stopOpacity="0.07" />
						<stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={`${prefix}paint2_radial_265`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(331 243.5) rotate(-180) scale(208)">
						<stop stopColor="#2CC256" stopOpacity="0.1" />
						<stop offset="1" stopColor="#2CC256" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={`${prefix}paint3_radial_265`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-94 71) scale(150)">
						<stop stopColor="#2CC256" stopOpacity="0.1" />
						<stop offset="1" stopColor="#2CC256" stopOpacity="0" />
					</radialGradient>
				</defs>
			</>
		),
		"2": (
			<>
				<rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill={`url(#${prefix}paint0_radial_266)`} />
				<rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill={`url(#${prefix}paint1_radial_266)`} />
				<rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill={`url(#${prefix}paint2_radial_266)`} />
				<rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill={`url(#${prefix}paint3_radial_266)`} />
				<rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill={`url(#${prefix}paint4_radial_266)`} />
				<defs>
					<radialGradient id={`${prefix}paint0_radial_266`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(300 243.5) rotate(-155.81) scale(205)">
						<stop stopColor="#2CC256" stopOpacity="0.1" />
						<stop offset="1" stopColor="#2CC256" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={`${prefix}paint1_radial_266`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="rotate(38.6107) scale(273.226)">
						<stop stopColor="#2CC256" stopOpacity="0.1" />
						<stop offset="1" stopColor="#2CC256" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={`${prefix}paint2_radial_266`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(103 383) rotate(-89.3415) scale(174.011)">
						<stop stopColor="#FAC507" stopOpacity="0.1" />
						<stop offset="1" stopColor="#FAC507" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={`${prefix}paint3_radial_266`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-50 242.5) scale(147.5)">
						<stop stopColor="#CD81F3" stopOpacity="0.07" />
						<stop offset="1" stopColor="#CD81F3" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={`${prefix}paint4_radial_266`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(425.5 62) rotate(-178.961) scale(193.032)">
						<stop stopColor="#FF6D2E" stopOpacity="0.07" />
						<stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
					</radialGradient>
				</defs>
			</>
		),
		"3": (
			<>
				<path fill={`url(#${prefix}a)`} d="M0 300h300V0H0v300Z" />
				<path fill={`url(#${prefix}b)`} d="M0 300h300V0H0v300Z" />
				<path fill={`url(#${prefix}c)`} d="M0 300h300V0H0v300Z" />
				<path fill={`url(#${prefix}d)`} d="M0 300h300V0H0v300Z" />
				<radialGradient id={`${prefix}a`} cx="0" cy="0" r="1" gradientTransform="matrix(0 181 -181 0 183 0)" gradientUnits="userSpaceOnUse">
					<stop stopColor="#5767C2" stopOpacity=".1" />
					<stop offset="1" stopColor="#5767C2" stopOpacity="0" />
				</radialGradient>
				<radialGradient id={`${prefix}b`} cx="0" cy="0" r="1" gradientTransform="translate(101 220.5) scale(142.5)" gradientUnits="userSpaceOnUse">
					<stop stopColor="#FF6D2E" stopOpacity=".07" />
					<stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
				</radialGradient>
				<radialGradient id={`${prefix}c`} cx="0" cy="0" r="1" gradientTransform="matrix(208 0 0 208 -31 56.5)" gradientUnits="userSpaceOnUse">
					<stop stopColor="#2CC256" stopOpacity=".1" />
					<stop offset="1" stopColor="#2CC256" stopOpacity="0" />
				</radialGradient>
				<radialGradient id={`${prefix}d`} cx="0" cy="0" r="1" gradientTransform="matrix(-150 0 0 -150 394 229)" gradientUnits="userSpaceOnUse">
					<stop stopColor="#2CC256" stopOpacity=".1" />
					<stop offset="1" stopColor="#2CC256" stopOpacity="0" />
				</radialGradient>
			</>
		),
	};

	return (
		<svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full will-change-transform z-[-1]">
			{gradients[id]}
		</svg>
	);
}

function getDefaultSuccessUrl(): string {
	return typeof window !== "undefined" ? new URL("/chat", window.location.origin).toString() : "";
}

export default function CheckoutModal(params: CheckoutModalProps) {
	const { refetch } = useCustomer();
	const [checkoutResult, setCheckoutResult] = useState<
		CheckoutResult | undefined
	>(params?.checkoutResult);

	useEffect(() => {
		if (params.checkoutResult) {
			setCheckoutResult(params.checkoutResult);
		}
	}, [params.checkoutResult]);

	const [loading, setLoading] = useState(false);

	if (!checkoutResult) {
		return <></>;
	}

	const { open, setOpen } = params;
	const { title, message } = getCheckoutContent(checkoutResult);

	const isFree = checkoutResult?.product.properties?.is_free;
	const isPaid = isFree === false;
	const gradientId = getGradientIdForProduct(checkoutResult.product.id);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				className={cn(
					"p-0 gap-0 max-w-[calc(100%-2rem)] sm:max-w-md overflow-hidden",
					"rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl",
					"bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md",
				)}
			>
				<div className="relative overflow-hidden">
					<CheckoutGradientBackground id={gradientId} />

					<div className="relative px-6 py-6 sm:px-8 sm:py-8 flex flex-col gap-6">
						<div className="space-y-2">
							<DialogTitle
								className={cn(
									"text-2xl font-bold leading-6 tracking-tight mb-4",
									TEXT_PRIMARY,
								)}
							>
								{title}
							</DialogTitle>
							<div className={cn("text-sm leading-6 tracking-tight", TEXT_MUTED)}>
								{message}
							</div>
						</div>

						{isPaid && checkoutResult && (
							<PriceInformation
								checkoutResult={checkoutResult}
								setCheckoutResult={setCheckoutResult}
							/>
						)}
					</div>

					<div className="relative w-full flex justify-center" aria-hidden>
						<svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full max-w-[calc(100%-3rem)]">
							<line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className={STROKE_MUTED} />
						</svg>
					</div>

					<DialogFooter className="flex flex-col-reverse sm:flex-row justify-end gap-3 px-6 py-5 sm:px-8 sm:py-6 bg-transparent border-0">
						<Button
							onClick={async () => {
								setLoading(true);
								const attachOptions = checkoutResult.options.map((o) => ({
									feature_id: o.feature_id,
									quantity: o.quantity,
								}));
								const result = await getSubscribeCheckoutUrl(
									checkoutResult.product.id,
									getDefaultSuccessUrl(),
									attachOptions.length ? attachOptions : undefined,
								);
								if ("url" in result) {
									window.location.href = result.url;
									return;
								}
								if ("attached" in result) {
									setOpen(false);
									refetch?.();
									setLoading(false);
									return;
								}
								setLoading(false);
							}}
							disabled={loading}
							className={cn(CHECKOUT_CTA_CLASS, "min-w-[140px]")}
						>
							{loading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<>
									<span>Confirmar</span>
									<ArrowRight className="h-4 w-4 shrink-0" />
								</>
							)}
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function PriceInformation({
	checkoutResult,
	setCheckoutResult,
}: {
	checkoutResult: CheckoutResult;
	setCheckoutResult: (checkoutResult: CheckoutResult) => void;
}) {
	return (
		<div className="flex flex-col gap-5">
			<ProductItems
				checkoutResult={checkoutResult}
				setCheckoutResult={setCheckoutResult}
			/>
			{checkoutResult?.has_prorations && checkoutResult.lines.length > 0 && (
				<CheckoutLines checkoutResult={checkoutResult} />
			)}
			<DueAmounts checkoutResult={checkoutResult} />
		</div>
	);
}

function DueAmounts({ checkoutResult }: { checkoutResult: CheckoutResult }) {
	const { next_cycle, product } = checkoutResult;
	const nextCycleAtStr = next_cycle
		? new Date(next_cycle.starts_at).toLocaleDateString("es-MX")
		: undefined;

	const hasUsagePrice = product.items.some(
		(item) => item.usage_model === "pay_per_use",
	);

	const showNextCycle = next_cycle && next_cycle.total !== checkoutResult.total;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-baseline justify-between gap-4">
				<p className={cn("text-sm font-medium", TEXT_PRIMARY)}>
					Total a pagar hoy
				</p>
				<p className={cn("text-2xl font-bold tracking-tight", TEXT_PRIMARY)}>
					{formatCurrency({
						amount: checkoutResult?.total,
						currency: checkoutResult?.currency,
					})}
				</p>
			</div>
			{showNextCycle && (
				<div className={cn("flex justify-between text-sm", TEXT_MUTED)}>
					<span>En el próximo ciclo ({nextCycleAtStr})</span>
					<span>
						{formatCurrency({
							amount: next_cycle.total,
							currency: checkoutResult?.currency,
						})}
						{hasUsagePrice && " + uso"}
					</span>
				</div>
			)}
		</div>
	);
}

function ProductItems({
	checkoutResult,
	setCheckoutResult,
}: {
	checkoutResult: CheckoutResult;
	setCheckoutResult: (checkoutResult: CheckoutResult) => void;
}) {
	const isUpdateQuantity =
		checkoutResult?.product.scenario === "active" &&
		checkoutResult.product.properties.updateable;

	const isOneOff = checkoutResult?.product.properties.is_one_off;

	const items = checkoutResult?.product.items.filter(
		(item) => item.type !== "feature",
	);

	return (
		<div className="flex flex-col gap-4">
			<p className={cn("text-sm font-medium", TEXT_PRIMARY)}>Resumen</p>
			<ul className="space-y-3 list-none p-0 m-0">
				{items?.map((item, index) => {
					if (item.usage_model === "prepaid") {
						return (
							<li key={index}>
								<PrepaidItem
									item={item}
									checkoutResult={checkoutResult!}
									setCheckoutResult={setCheckoutResult}
								/>
							</li>
						);
					}

					if (isUpdateQuantity) {
						return null;
					}

					const label = item.feature
						? item.feature.name
						: isOneOff
							? "Concepto"
							: "Suscripción mensual";
					const value = `${translateBillingToSpanish(item.display?.primary_text)} ${translateBillingToSpanish(item.display?.secondary_text)}`.trim();

					return (
						<li
							key={index}
							className={cn(
								"flex items-center justify-between gap-3 text-sm",
								TEXT_SECONDARY,
							)}
						>
							<span className="flex items-center gap-3">
								<Check className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
								{label}
							</span>
							<span className="text-right">{value}</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function CheckoutLines({ checkoutResult }: { checkoutResult: CheckoutResult }) {
	const lines = checkoutResult?.lines.filter((line) => line.amount !== 0) ?? [];

	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="total" className="border-none">
				<CustomAccordionTrigger className="justify-end w-full my-0 py-0 border-none min-h-0 [&[data-state=open]_svg]:rotate-180">
					<div className="cursor-pointer flex items-center gap-1.5 w-full justify-end">
						<span className={cn("text-sm font-medium", TEXT_MUTED)}>
							Ver desglose
						</span>
						<ChevronDown
							className={cn("opacity-60 transition-transform duration-200", TEXT_MUTED)}
							size={14}
							aria-hidden
						/>
					</div>
				</CustomAccordionTrigger>
				<AccordionContent className="mt-2 pt-2 flex flex-col gap-2">
					{lines.map((line, index) => (
						<div
							key={index}
							className={cn("flex justify-between text-sm", TEXT_MUTED)}
						>
							<span>{translateBillingToSpanish(line.description)}</span>
							<span>
								{new Intl.NumberFormat("es-MX", {
									style: "currency",
									currency: checkoutResult?.currency,
								}).format(line.amount)}
							</span>
						</div>
					))}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

function CustomAccordionTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					"flex flex-1 items-center justify-between gap-2 rounded-lg py-2 text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
					className,
				)}
				{...props}
			>
				{children}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

const PrepaidItem = ({
	item,
	checkoutResult,
	setCheckoutResult,
}: {
	item: ProductItem;
	checkoutResult: CheckoutResult;
	setCheckoutResult: (checkoutResult: CheckoutResult) => void;
}) => {
	const { quantity = 0, billing_units: billingUnits = 1 } = item;
	const [quantityInput, setQuantityInput] = useState<string>(
		(quantity / billingUnits).toString(),
	);
	const { checkout } = useCustomer();
	const [loading, setLoading] = useState(false);
	const [open, setOpen] = useState(false);
	const scenario = checkoutResult.product.scenario;

	const handleSave = async () => {
		setLoading(true);
		try {
			const newOptions = checkoutResult.options
				.filter((option) => option.feature_id !== item.feature_id)
				.map((option) => {
					return {
						featureId: option.feature_id,
						quantity: option.quantity,
					};
				});

			newOptions.push({
				featureId: item.feature_id!,
				quantity: Number(quantityInput) * billingUnits,
			});

			const { data, error } = await checkout({
				productId: checkoutResult.product.id,
				options: newOptions,
				dialog: CheckoutModal,
			});

			if (error) {
				console.error(error);
				return;
			}
			setCheckoutResult(data!);
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
			setOpen(false);
		}
	};

	const disableSelection = scenario === "renew";

	return (
		<div className={cn("flex items-center justify-between gap-3 text-sm", TEXT_SECONDARY)}>
			<span className="flex items-center gap-3 min-w-0">
				<Check className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
				<span className="truncate">{item.feature?.name}</span>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						className={cn(
							"shrink-0 text-xs px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center gap-1",
							TEXT_MUTED,
							"bg-white/80 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 transition-colors",
							disableSelection && "pointer-events-none opacity-60 cursor-not-allowed",
						)}
						disabled={disableSelection}
					>
						Cantidad: {quantity}
						{!disableSelection && <ChevronDown size={12} className="opacity-70" />}
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className={cn(
							"w-72 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800",
							"bg-white dark:bg-zinc-900 shadow-xl",
						)}
					>
						<div className="flex flex-col gap-3">
							<div>
								<p className={cn("text-sm font-medium", TEXT_PRIMARY)}>{item.feature?.name}</p>
								<p className={cn("text-xs mt-0.5", TEXT_MUTED)}>
									{translateBillingToSpanish(item.display?.primary_text)}{" "}
									{translateBillingToSpanish(item.display?.secondary_text)}
								</p>
							</div>
							<div className="flex justify-between items-center gap-3">
								<div className="flex gap-2 items-center">
									<Input
										className="h-9 w-16 rounded-[50px] border-zinc-200 dark:border-zinc-700 text-sm"
										value={quantityInput}
										onChange={(e) => setQuantityInput(e.target.value)}
									/>
									<span className={cn("text-xs", TEXT_MUTED)}>
										{billingUnits > 1 && `× ${billingUnits} `}
										{item.feature?.name}
									</span>
								</div>
								<Button
									onClick={handleSave}
									className={cn("rounded-[50px] h-9 px-4 text-sm", CHECKOUT_CTA_CLASS)}
									disabled={loading}
								>
									{loading ? (
										<Loader2 className="animate-spin h-4 w-4" />
									) : (
										"Guardar"
									)}
								</Button>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</span>
			<span className="text-right shrink-0">
				{translateBillingToSpanish(item.display?.primary_text)}{" "}
				{translateBillingToSpanish(item.display?.secondary_text)}
			</span>
		</div>
	);
};

export const PriceItem = ({
	children,
	className,
	...props
}: {
	children: React.ReactNode;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
	return (
		<div
			className={cn(
				"flex flex-col pb-4 sm:pb-0 gap-1 sm:flex-row justify-between sm:h-7 sm:gap-2 sm:items-center",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
};

export const PricingModalButton = ({
	children,
	size,
	onClick,
	disabled,
	className,
}: {
	children: React.ReactNode;
	size?: "sm" | "lg" | "default" | "icon";
	onClick: () => void;
	disabled?: boolean;
	className?: string;
}) => {
	return (
		<Button
			onClick={onClick}
			disabled={disabled}
			size={size}
			className={cn(CHECKOUT_CTA_CLASS, "min-w-[140px]", className)}
		>
			{children}
			<ArrowRight className="h-4 w-4 shrink-0" />
		</Button>
	);
};
