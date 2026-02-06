import type { Dictionary } from "@/types/dictionary";

type WhatIsRIFTSectionProps = {
  dict: Dictionary["whatIsRift"];
};

export default function WhatIsRIFTSection({ dict }: WhatIsRIFTSectionProps) {
  return (
    <section id="about" aria-labelledby="about-heading" className="scroll-mt-20 pt-24 md:pt-0">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 w-full -mb-4">
          <span className="transition-opacity duration-150 ease-out text-blue-500 font-semibold gap-1.5 items-center flex">
            {dict.label}
          </span>
          <h2 id="about-heading" className="text-4xl leading-[54.4px] tracking-[-0.5px] font-bold m-0">
            {dict.heading}
          </h2>
        </div>
        <p className="text-landing-text-secondary select-text text-gray-600 text-pretty m-0">
          {dict.body}
        </p>
      </div>
    </section>
  );
}
