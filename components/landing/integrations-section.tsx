import { Google, Microsoft, Okta, Scim } from "@/components/ui/icons/svg-icons";
import type { Dictionary } from "@/types/dictionary";

type IntegrationsSectionProps = {
  dict: Dictionary["integrations"];
};

export default function IntegrationsSection({ dict }: IntegrationsSectionProps) {
  return (
    <section className="pt-24 md:pt-0" id="integrations" aria-labelledby="integrations-heading">
      <div className="gap-8 flex flex-col ">
        <div className="gap-2 w-full flex flex-col -mb-4">
          <span className="transition-opacity duration-150 ease-out text-orange-400 font-semibold gap-1.5 items-center flex">
            {dict.label}
          </span>
          <h2 id="integrations-heading" className="text-4xl leading-[54.4px] tracking-[-0.5px] font-bold m-0">
            {dict.heading}
          </h2>
        </div>
        <div className="flex flex-col">
          <p className="text-landing-text-secondary mb-5">
            {dict.intro}
          </p>

          <div className="w-full max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
              <div className="w-full h-24 flex items-center justify-center p-4 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.04)] dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl shadow-sm transition-colors">
                <Google className="h-8 w-auto" />
              </div>
              <div className="w-full h-24 flex items-center justify-center p-4 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.04)] dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl shadow-sm transition-colors">
                <Microsoft className="h-8 w-auto" />
              </div>
              <div className="w-full h-24 flex items-center justify-center p-4 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.04)] dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl shadow-sm transition-colors">
                <Okta className="h-8 w-auto dark:invert" />
              </div>
              <div className="w-full h-24 flex items-center justify-center p-4 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.04)] dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl shadow-sm transition-colors">
                <Scim className="h-8 w-auto text-gray-700 dark:text-gray-300" />
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
              {dict.supportNote}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
