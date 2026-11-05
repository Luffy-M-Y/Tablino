import { ChevronRight } from "lucide-react";
import { mutedClass, variantStyles } from "@/components/ui/kit";

export interface Step {
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number; // 1-based
  /** "cours" | "devoirs" — d\u00e9termine la couleur active */
  variant?: "cours" | "devoirs";
}

export function StepIndicator({ steps, currentStep, variant = "cours" }: StepIndicatorProps) {
  const activeClass = variantStyles[variant].activeStep;
  const doneClass = variantStyles[variant].doneStep;
  const todoClass = `bg-white border-[color:var(--color-input-border)] ${mutedClass}`;

  return (
    <nav aria-label="\u00c9tapes de navigation" className="mb-6">
      <ol className="flex items-center gap-0 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const num = i + 1;
          const isActive = num === currentStep;
          const isDone = num < currentStep;

          return (
            <li key={i} className="flex items-center shrink-0">
              <div className="flex items-center gap-1.5">
                <span
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-bold transition-colors ${
                    isActive ? activeClass : isDone ? doneClass : todoClass
                  }`}
                >
                  {num}
                </span>
                <span
                  className={`text-xs whitespace-nowrap transition-colors ${
                    isActive ? "text-[color:var(--color-text)] font-semibold" : mutedClass
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className={`mx-1 shrink-0 ${mutedClass}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
