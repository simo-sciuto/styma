import { PageHeader } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';

export const metadata = { title: 'Account — STYMA' };

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <PageHeader title="Account" />
      <div className="mt-6">
        <AccountPanel />
      </div>
    </main>
  );
}
