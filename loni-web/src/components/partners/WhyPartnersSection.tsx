import together from '../../assets/partners/together.webp';
import { WhySection } from '../roles/WhySection';

/** "Why It Matters" for partners and family: the shared block with the partner copy and the couple photo. */
export function WhyPartnersSection() {
  return (
    <WhySection
      id="why-partners"
      titleId="why-partners-title"
      badge="Why It Matters"
      statement={[
        'The right support can make pregnancy',
        'feel a little less overwhelming. LONI',
        'helps trusted people stay connected',
        "without taking over the mother's",
        'journey.',
      ]}
      cards={[
        {
          title: ['Show up in the', 'moments that matter'],
          text: ['Be informed, stay engaged and know', 'how to be there during pregnancy and', 'beyond.'],
        },
        {
          title: ['Without the', 'guesswork'],
          text: ["LONI helps you understand what's", 'happening so you can support her', 'with confidence.'],
        },
        {
          title: ['Her journey, your', 'connection'],
          text: ['Partners and family stay', 'connected in a way that feels', 'natural and respectful.'],
        },
      ]}
      photo={{
        src: together,
        alt: 'An expectant couple smiling together outdoors',
        width: 359,
        height: 302,
      }}
      canvas={{
        w: 1600,
        h: 924,
        badge: [54, 113],
        avatars: [51, 222],
        stat: [51, 294],
        statement: [685, 116],
        statementSize: 41.5,
        statementLh: 52.3,
        cardsX: [51, 367],
        cardsY: 477,
        card: [349, 336],
        cardFont: 15,
        photo: [1151, 477, 399, 336],
      }}
    />
  );
}
