type Segment = {
  label: string;
  from: string;
  to?: string;
};

interface OverviewSectionProps {
  keyPoints: Segment[];
}

export function OverviewSection({ keyPoints }: OverviewSectionProps) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-base font-medium">Overview of meeting</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        In this recorded session, Nolan and Emir discussed product feedback focused
        on improving user experience and visual clarity across key areas of the
        platform. The conversation touched on usability, design consistency, and
        future roadmap alignment.
      </p>

      {/* Key Points */}
      <div className="mt-6">
        <h2 className="mb-3 text-base font-medium">Key Points Covered</h2>
        <div className="space-y-3">
          {keyPoints.map((point, index) => (
            <div key={index}>
              <div className="mb-1">
                <span className="font-medium">
                  {index + 1}. {point.label}
                </span>{" "}
                <button className="text-base text-blue-600 hover:underline dark:text-blue-400">
                  [{point.from}]
                </button>
              </div>
              {index === 0 && (
                <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    • Nolan briefly introduced the product&apos;s current stage and
                    outlined user insights gathered over the last sprint.
                  </li>
                </ul>
              )}
              {index === 1 && (
                <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    • Emir provided input on layout hierarchy, button contrast, and
                    spacing issues.
                  </li>
                  <li>
                    • Suggestions to improve visual grouping and enhance interaction
                    clarity.
                  </li>
                </ul>
              )}
              {index === 2 && (
                <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    • Deep dive into the timeline editor and annotation tools.
                  </li>
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
