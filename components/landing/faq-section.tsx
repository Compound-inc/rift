import type { Dictionary } from "@/types/dictionary";

type FaqSectionProps = {
  dict: Dictionary["faq"];
};

export default function FaqSection({ dict }: FaqSectionProps) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-20 pt-24 md:pt-0"
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 w-full -mb-4">
          <span className="text-landing-accent font-semibold gap-1.5 flex items-center transition-opacity duration-150">
            {dict.label}
          </span>
          <h2
            id="faq-heading"
            className="text-[40px] leading-[54.4px] tracking-[-0.5px] font-bold m-0"
          >
            {dict.heading}
          </h2>
          <p className="text-landing-text-secondary m-0 max-w-2xl">
            {dict.summary}
          </p>
        </div>

        <div className="w-full flex flex-col gap-2">
            {dict.items.map((faq, index) => (
              <article
                key={index}
                itemScope
                itemType="https://schema.org/Question"
                className="mb-2"
              >
                <details
                  name="faq-accordion"
                  className="group flex flex-col items-start justify-start rounded-2xl border-b-[rgba(55,55,55,0.4)] bg-[rgba(44,45,48,0.02)] dark:bg-white/5 dark:border-white/10 border-none open:bg-[rgba(44,45,48,0.04)] transition-colors duration-200"
                >
                  <summary
                    className="flex w-full items-center justify-between gap-12 px-8 py-6 max-[512px]:gap-4 max-[512px]:px-4 max-[512px]:py-3 hover:no-underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 rounded-2xl list-none [&::-webkit-details-marker]:hidden"
                  >
                    <div>
                      <h3
                        id={`faq-question-${index}`}
                        itemProp="name"
                        className="select-text text-left tracking-[-0.5px] font-medium text-xl m-0"
                        style={{ WebkitTextStroke: "0.001px transparent" }}
                      >
                        {faq.question}
                      </h3>
                    </div>
                  <div className="relative flex h-6 w-6 flex-shrink-0 select-none items-center justify-center py-1 bg-[rgba(44,45,48,0.03)] dark:bg-white/10 rounded-[50%]">
                    <div
                      className="absolute top-1/2 left-1/2 h-0.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[linear-gradient(90deg,rgb(148,114,80),rgb(108,128,113))] dark:bg-[linear-gradient(90deg,rgb(200,180,150),rgb(150,170,160))] transition-opacity duration-200 group-open:opacity-0"
                    ></div>
                    <div
                      className="absolute top-1/2 left-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[linear-gradient(rgb(148,114,80),rgb(108,128,113))] dark:bg-[linear-gradient(rgb(200,180,150),rgb(150,170,160))] transition-transform duration-200 group-open:rotate-90"
                    ></div>
                  </div>
                </summary>
                <div className="pb-0 overflow-hidden animate-fadeIn duration-500">
                   <div 
                     itemProp="acceptedAnswer"
                     itemScope
                     itemType="https://schema.org/Answer"
                     className="pr-20 pb-6 pl-8 max-[512px]:px-4 max-[512px]:pt-2 max-[512px]:pb-3"
                   >
                    <p itemProp="text" className="text-landing-text-secondary m-0">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </details>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}
