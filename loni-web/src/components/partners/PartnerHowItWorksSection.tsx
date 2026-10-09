import motherResting from '../../assets/partners/mother-resting.webp';
import { ControlsIcon, EyeIcon, LinkIcon, NotificationIcon, SendIcon } from '../icons/PartnerIcons';
import { TopicGridSection, type Rect, type Topic } from '../roles/TopicGridSection';

const TOPICS: Topic[] = [
  { title: 'Mother invites partner or family', lines: ['She chooses who joins her support system.'], icon: <SendIcon /> },
  { title: 'Partner connects', lines: ['Simple setup through the LONI app.'], icon: <LinkIcon /> },
  { title: 'Mother controls shared access', lines: ['She decides what is visible and shared.'], icon: <ControlsIcon /> },
  { title: 'Partner stays connected', lines: ['Relevant milestones and updates as they happen.'], icon: <EyeIcon /> },
  {
    title: 'Partner receives relevant updates',
    lines: ['Emergency notifications when enabled by the mother.'],
    icon: <NotificationIcon />,
  },
];

/**
 * Cards on a 3-column grid (483 × 317). As in the design, the third card sits 6px higher and the
 * photo tile (484 × 329) overhangs its row by 6px.
 */
const RECTS: Rect[] = [
  [50, 340, 483, 317],
  [545, 340, 483, 317],
  [1040, 334, 484, 318],
  [50, 669, 483, 317],
  [545, 669, 483, 317],
  [1040, 663, 484, 329], // photo
];

/** "We make it easy to stay close, wherever you are": the five connection steps plus a photo. */
export function PartnerHowItWorksSection() {
  return (
    <TopicGridSection
      id="how-it-works"
      titleId="partner-how-it-works-title"
      badge="How It Works"
      heading={['We make it easy to stay close,', 'wherever you are.']}
      intro={[
        'Getting connected takes just a few steps, and everything stays',
        'in her control.',
      ]}
      topics={TOPICS}
      photo={{
        src: motherResting,
        alt: 'An expectant mother resting a hand on her belly in a warmly lit room',
        width: 445,
        height: 302,
      }}
      canvas={{
        w: 1566,
        h: 1098,
        badge: [53, 52],
        heading: [50, 155],
        headingSize: 41,
        headingLh: 51,
        intro: [979, 185, 590],
        introSize: 19,
        introLh: 36,
        rects: RECTS,
        cardFont: 15,
      }}
    />
  );
}
