import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '../components/layout/PageShell';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you were looking for could not be found.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <PageShell>
      <section className="flex min-h-[60svh] flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">404</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.02em] text-black sm:text-5xl">Page not found</h1>
        <p className="mt-4 max-w-md text-base text-neutral-500">
          The page you were looking for doesn’t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-full bg-black px-6 text-[15px] font-semibold text-white transition-colors hover:bg-neutral-800"
        >
          Back to home
        </Link>
      </section>
    </PageShell>
  );
}
