import { AccountPanel } from '@/features/auth/AccountPanel';

export const metadata = { title: 'Account — STYMA' };

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-20 pt-6">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Account</h1>
      <AccountPanel />
    </main>
  );
}
