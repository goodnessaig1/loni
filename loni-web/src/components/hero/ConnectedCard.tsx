import avatars from '../../assets/avatars.webp';
import couple from '../../assets/couple.webp';

export function ConnectedCard({ className = '' }: { className?: string }) {
  return (
    <div className={`flex w-[15.5rem] gap-2 rounded-2xl bg-white p-2 text-neutral-900 lg:w-[17.5rem] ${className}`}>
      <div className="flex flex-1 flex-col justify-between py-1.5 pl-2">
        <p className="max-w-[9rem] text-sm font-semibold leading-snug lg:text-[15px]">Connected through every step</p>
        <img src={avatars} alt="" className="h-7 w-auto self-start lg:h-8" draggable={false} />
      </div>
      <img
        src={couple}
        alt="A couple expecting, with family"
        className="size-[5.5rem] shrink-0 rounded-xl object-cover lg:size-[6.25rem]"
        draggable={false}
      />
    </div>
  );
}
