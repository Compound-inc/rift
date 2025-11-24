import { SVGProps } from "react";

export function ZaiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Z.AI</title>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.4"
      />
      <path
        d="M7 8h10l-10 8h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="8" r="0.9" fill="currentColor" />
      <circle cx="16.5" cy="16" r="0.9" fill="currentColor" />
    </svg>
  );
}

