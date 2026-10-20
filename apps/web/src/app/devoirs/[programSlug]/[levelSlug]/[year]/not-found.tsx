import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
      <p className="text-slate-700 font-medium mb-4">Cette année académique est introuvable.</p>
      <Link href="/devoirs" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">Retour aux filières</Link>
    </div>
  );
}
