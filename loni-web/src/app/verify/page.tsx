import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NO_INDEX } from '../../lib/seo/metadata';
import VerifyPage from '../../views/VerifyPage';

export const metadata: Metadata = {
  title: 'Complete Your Partner Account',
  description: 'Finish setting up the LONI partner account you were invited to.',
  robots: NO_INDEX,
};

export default function Page() {
  // The form reads `?email=` on the client, so it renders after hydration (as it did before).
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <VerifyPage />
    </Suspense>
  );
}
