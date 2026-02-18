import { LightWeightCards } from "@/components/landing/components/sideway";
import Image from "next/image";

export default function KnowledgeCenterSection() {
  return (
    <section>
      <div className="gap-8 flex flex-col">
        <div className="gap-2 w-full flex flex-col -mb-4">
          <span className="transition-opacity duration-150 ease-out text-blue-500 font-semibold gap-1.5 items-center flex">
            Centro de Conocimiento
          </span>
          <h4 className="text-4xl leading-[54.4px] tracking-[-0.5px] font-bold m-0">
            Domina a la IA
          </h4>
        </div>

        <p className="text-landing-text-secondary">
          La Inteligencia artificial suele tener una fama de ser una herramienta
          compleja y difícil de dominar. Sin embargo, nosotros creemos que todos
          los usuarios se pueden beneficiar de conocer como
          funciona y sus conceptos generales, De esta forma, los usuarios pueden
          generar &quot;Prompts&quot;, conocer las limitaciones y aprender como sacar mayor
          provecho a la IA;
        </p>
        <p className="text-[rgb(92,92,92)] mb-6">
          Por esto, esamos generando materiales, videos y explicaciones del
          funcionamiento de la IA como parte de tu subscripcion
        </p>
        <div className="w-full">
          <LightWeightCards.Root>
            {cardData.map((item, index) => (
              <LightWeightCards.Card
                className="max-w-[200px] md:max-w-sm w-full"
                index={index}
                key={index}
              >
                <div className="p-4 h-full flex items-center justify-center">
                  <Image
                    src={item.svg}
                    alt={item.alt}
                    width={120}
                    height={120}
                    className="w-full h-full object-contain"
                  />
                </div>
              </LightWeightCards.Card>
            ))}
          </LightWeightCards.Root>
        </div>
      </div>
    </section>
  );
}
const cardData = [
  {
    svg: "/1.svg",
    alt: "Blog post",
  },
  {
    svg: "/2.svg",
    alt: "Social media caption",
  },
  {
    svg: "/1.svg",
    alt: "Email newsletter",
  },
];
