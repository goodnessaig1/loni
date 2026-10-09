import privacyCard from '../../assets/partners/privacy-card.webp';
import { DetailSection } from '../drivers/DetailSection';

/** "We know her journey matters to you, too": four privacy promises beside the Emergency Contacts screen. */
export function PrivacySection() {
  return (
    <DetailSection
      id="privacy-control"
      titleId="privacy-control-title"
      badge="Privacy & Control"
      heading={['We know her journey', 'matters to you, too.']}
      intro={[
        'LONI keeps the mother in control of what she shares with her support',
        'system. Partner and family access does not automatically mean access',
        'to private medical information.',
      ]}
      details={[
        { title: 'She decides who joins her support system.' },
        { title: 'Private medical information is not automatically shared.' },
        { title: 'She controls what each person can see at any time.' },
        { title: 'Partners only see what she actively chooses to share.' },
      ]}
      card={{
        src: privacyCard,
        alt: "The LONI app's Emergency Contacts screen with an \"Add Support Partners\" button and a connected partner",
      }}
      canvas={{
        w: 1657,
        h: 1433,
        badge: [56, 131],
        heading: [53, 241],
        intro: [974, 236],
        list: [60, 503.6, 708],
        card: [848, 466, 764],
        headingSize: 42,
        headingLh: 54,
        introSize: 19.5,
        introLh: 38,
        listFont: 17.3,
        rowHeight: 5.63,
      }}
    />
  );
}
