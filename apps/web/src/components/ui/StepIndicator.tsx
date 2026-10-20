import { ChevronRight } from "lucide-react";

export interface Step {
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number; // 1-based
  /** "cours" | "devoirs" — détermine la couleur active */
  variant?: "cours" | "devoirs";
}

export function StepIndicator({ steps, currentStep, variant = "cours" }: StepIndicatorProps) {
  const activeClass =
    variant === "devoirs"
      ? "bg-teal-600 text-white border-teal-600"
      : "bg-uni-600 text-white border-uni-600";

  const doneClass =
    variant === "devoirs"
      ? "bg-teal-100 text-teal-700 border-teal-300"
      : "bg-uni-100 text-uni-700 border-uni-300";

  return (
    <nav aria-label="Étapes de navigation" className="mb-6">
      <ol className="flex items-center gap-0 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const num = i + 1;
          const isActive = num === currentStep;
          const isDone = num < currentStep;
          const isPending = num > currentStep;

          return (
            <li key={i} className="flex items-center shrink-0">
              <div className="flex items-center gap-1.5">
                <span
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-bold transition-colors
                    ${isActive ? activeClass : isDone ? doneClass : "bg-white text-slate-400 border-slate-200"}`}
                >
                  {num}
                </span>
                <span
                  className={`text-xs font-medium whitespace-nowrap transition-colors
                    ${isActive ? (variant === "devoirs" ? "text-teal-700" : "text-uni-700") : isDone ? "text-slate-500" : "text-slate-400"}`}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className="mx-1 text-slate-300 shrink-0"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
