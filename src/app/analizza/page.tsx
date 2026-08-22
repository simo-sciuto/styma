import Link from 'next/link';
import { AnalyzeFlow } from '@/features/analyze/AnalyzeFlow';

export const metadata = { title: 'Analizza un oggetto — STYMA' };

export default function AnalyzePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-20 pt-8">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ← STYMA
      </Link>
      <AnalyzeFlow />
    </main>
  );
}
