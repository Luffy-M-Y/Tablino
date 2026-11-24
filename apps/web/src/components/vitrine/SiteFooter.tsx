import { GraduationCap } from "lucide-react";
import { focusRing } from "@/components/ui/kit";

const linkClass = `rounded text-sm text-[color:var(--color-on-band-muted)] hover:text-[color:var(--color-on-band)] focus-visible:outline-[color:var(--color-ring-on-band)] ${focusRing}`;

export function SiteFooter({ signupUrl }: { signupUrl: string | null }) {
  return (
    <footer className="bg-[color:var(--color-brand)] text-[color:var(--color-on-band)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold">
            <GraduationCap size={26} aria-hidden="true" />
            Tablino
          </p>
          <p className="mt-2 max-w-xs text-sm text-[color:var(--color-on-band-muted)]">
            L&rsquo;archive num&eacute;rique des cours et devoirs de votre universit&eacute;.
          </p>
        </div>
        <nav aria-label="Liens du pied de page">
          <p className="text-sm font-semibold">D&eacute;couvrir</p>
          <ul className="mt-3 space-y-2">
            <li><a href="#fonctionnement" className={linkClass}>Fonctionnement</a></li>
            <li><a href="#etudiants" className={linkClass}>Pour les &eacute;tudiants</a></li>
            <li><a href="#universites" className={linkClass}>Pour les universit&eacute;s</a></li>
            <li><a href="#offres" className={linkClass}>Offres</a></li>
            <li><a href="#faq" className={linkClass}>Questions fr&eacute;quentes</a></li>
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold">Commencer</p>
          <ul className="mt-3 space-y-2">
            <li><a href="#commencer" className={linkClass}>Trouver mon universit&eacute;</a></li>
            {signupUrl && (
              <li><a href={signupUrl} className={linkClass}>Cr&eacute;er le compte de mon universit&eacute;</a></li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-[color:var(--color-on-band-muted)] sm:px-6">
          &copy; Tablino
        </p>
      </div>
    </footer>
  );
}
