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
  const ringClass = variant === "devoirs" ? "shadow-[0_0_0_4px_rgb(234_88_12/18%)]" : "shadow-[0_0_0_4px_rgb(37_99_235/15%)]";
  const lineDoneClass = variant === "devoirs" ? "bg-[color:var(--color-accent)]" : "bg-[color:var(--color-primary)]";
  const todoClass = `bg-white border-[color:var(--color-input-border)] ${mutedClass}`;

  return (
    <nav aria-label="\u00c9tapes de navigation" className="mb-8">
      <ol className="flex items-center gap-0 overflow-x-auto rounded-[1.25rem] border border-[color:var(--color-border)] bg-white px-4 py-3 shadow-sm">
        {steps.map((step, i) => {
          const num = i + 1;
          const isActive = num === currentStep;
          const isDone = num < currentStep;

          return (
            <li key={i} className="flex items-center shrink-0">
              <div className="flex items-center gap-1.5">
                <span
                  aria-current={isActive ? "step" : undefined}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                    isActive ? `${activeClass} ${ringClass}` : isDone ? doneClass : todoClass
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
                <span
                  aria-hidden="true"
                  className={`mx-2 h-0.5 w-6 shrink-0 rounded-full sm:w-10 ${
                    isDone ? lineDoneClass : "bg-[color:var(--color-border)]"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
