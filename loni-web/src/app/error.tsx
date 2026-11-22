'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-3xl font-bold tracking-[-0.02em] text-black sm:text-4xl">Something went wrong</h1>
      <p className="mt-4 max-w-md text-base text-neutral-500">Please try again. If it keeps happening, contact support.</p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#b51e71]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full border border-neutral-900 px-6 text-[15px] font-medium text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
