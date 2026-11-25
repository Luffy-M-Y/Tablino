import { BackButton } from "@/components/ui/BackButton";
import { mutedClass } from "@/components/ui/kit";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
      <p className={`mb-4 text-sm ${mutedClass}`}>
        Ce niveau est introuvable.
      </p>
      <BackButton href="/cours">
        Retour aux fili&egrave;res
      </BackButton>
    </div>
  );
}
