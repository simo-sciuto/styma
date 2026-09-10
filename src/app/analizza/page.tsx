import { AnalyzeFlow } from '@/features/analyze/AnalyzeFlow';

export const metadata = { title: 'Analizza un oggetto — STYMA' };

export default function AnalyzePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <AnalyzeFlow />
    </main>
  );
}
