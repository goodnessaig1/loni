import { Star } from 'lucide-react';

export function Rating({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2.5 text-white lg:items-end ${className}`}>
      <p className="text-xs font-semibold lg:text-[13px]">Rated Excellent: 5/5</p>
      <div className="flex gap-1.5 lg:gap-2" role="img" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className="size-[18px] fill-white lg:size-6" strokeWidth={0} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
