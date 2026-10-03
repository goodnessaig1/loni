import { motion } from 'framer-motion';

const QUESTION_PILLS = [
  {
    id: 1,
    text: '“I Have A Question.”',
    icon: (
      <svg className="size-5 shrink-0 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: 2,
    text: '“I Don’t Feel Quite Right.”',
    icon: (
      <svg className="size-5 shrink-0 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    id: 3,
    text: '“I Need Someone To Talk To.”',
    icon: (
      <svg className="size-5 shrink-0 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="8" y1="10" x2="8.01" y2="10" />
        <line x1="12" y1="10" x2="12.01" y2="10" />
        <line x1="16" y1="10" x2="16.01" y2="10" />
      </svg>
    ),
  },
  {
    id: 4,
    text: 'I Need Help Getting To The Hospital.',
    icon: (
      <svg className="size-5 shrink-0 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6v4M10 8h4M4 22h16M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
        <path d="M10 14h4v8h-4z" />
      </svg>
    ),
  },
];

export function ProblemSection() {
  return (
    <section aria-labelledby="problem-title" className="px-5 pt-4 pb-16 sm:px-8 sm:pt-8 sm:pb-24 lg:pt-8 lg:pb-32">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-12 lg:flex-row lg:items-start lg:gap-16">
        {/* Left Side: Title & Badge */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-start gap-6 lg:w-5/12"
        >
          <h2
            id="problem-title"
            className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-[3.75rem] lg:leading-[1.1]"
          >
            The problem<span className="text-[#E2027A]">.</span>
          </h2>

          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
            whileInView={{ opacity: 1, scale: 1, rotate: -3.09 }}
            viewport={{ once: false }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
            whileHover={{ rotate: 0, scale: 1.05 }}
            className="inline-flex items-center gap-[14px] rounded-full px-[17px] py-[10px] text-xs font-semibold text-white shadow-sm cursor-pointer sm:text-sm border-t border-r border-l border-b-0 border-dashed border-[#0C6800A3]"
            style={{
              backgroundColor: '#15B300',
              borderWidth: '1px 1px 0px 1px',
              borderStyle: 'dashed',
              borderColor: '#0C6800A3',
            }}
          >
            <span className="size-2 rounded-full bg-white shrink-0" />
            <span>Loni exists for you</span>
          </motion.div>
        </motion.div>

        {/* Right Side: Description, Divider, & Pills */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-8 lg:w-7/12 lg:pl-6"
        >
          <p className="text-xl font-semibold leading-relaxed text-neutral-900 sm:text-2xl lg:text-[1.65rem] lg:leading-[1.45]">
            Pregnancy comes with questions and unexpected concerns. LONI brings the answers, support, and care you need closer, so you never have to figure it all out alone.
          </p>

          <hr className="border-t border-neutral-200" />

          {/* Question Pills Grid */}
          <div className="flex flex-wrap gap-3.5 sm:gap-4">
            {QUESTION_PILLS.map((pill, index) => (
              <motion.div
                key={pill.id}
                initial={{ opacity: 0, y: 20, scale: 0.92 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: false }}
                transition={{
                  duration: 0.5,
                  delay: 0.25 + index * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center gap-2.5 rounded-full border border-neutral-900 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-all hover:bg-neutral-50 hover:shadow-md cursor-pointer sm:text-[15px]"
              >
                {pill.icon}
                <span>{pill.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
