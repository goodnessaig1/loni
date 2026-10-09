import nurseOnCall from '../../assets/nurses/on-call.webp';
import { WhySection } from '../roles/WhySection';

/** "Why It Matters" for nurses: the shared block with the nurse copy and the on-call photo. */
export function WhyNursesSection() {
  return (
    <WhySection
      id="why-nurses"
      titleId="why-nurses-title"
      badge="Why It Matters"
      statement={[
        'LONI Bot can help with everyday questions,',
        'but some moments call for a real person.',
        "That's where you come in. You bring",
        'experience, empathy and presence that no',
        'AI can replicate.',
      ]}
      cards={[
        {
          title: ['Voice calls, real', 'conversations'],
          text: ['Connect with mothers through voice,', 'not chat or messaging. Real support,', 'real time.'],
        },
        {
          title: ['Meaningful', 'maternity care'],
          text: ['Use your professional knowledge to', 'support mothers through their', 'pregnancy journey.'],
        },
        {
          title: ['Available on your', 'schedule'],
          text: ['Manage your availability and', "take calls when you're ready to", 'help.'],
        },
      ]}
      photo={{
        src: nurseOnCall,
        alt: 'A smiling LONI nurse in blue scrubs taking a call on a headset',
        width: 359,
        height: 302,
      }}
      canvas={{
        w: 1618,
        h: 990,
        badge: [54, 115],
        avatars: [51, 235],
        stat: [51, 307],
        statement: [692, 128],
        statementSize: 41.5,
        statementLh: 53,
        cardsX: [51, 370.5],
        cardsY: 493,
        card: [352, 339],
        cardFont: 15,
        photo: [1163, 493, 403, 339],
      }}
    />
  );
}
