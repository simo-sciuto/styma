import Link from 'next/link';
import { AccountPanel } from '@/features/auth/AccountPanel';

export const metadata = { title: 'Account — STYMA' };

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-20 pt-8">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ← STYMA
      </Link>
      <h1 className="mt-6 mb-5 text-2xl font-semibold tracking-tight">Account</h1>
      <AccountPanel />
    </main>
  );
}
