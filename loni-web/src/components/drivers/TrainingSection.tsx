import { GaugeIcon, MoneyBagIcon, MotherIcon, ShieldPersonIcon, SirenIcon } from '../icons/TrainingIcons';
import { SITE } from '../../config/site';
import { TopicGridSection, type Rect, type Topic } from '../roles/TopicGridSection';

const TOPICS: Topic[] = [
  {
    title: 'Basic driving rules',
    lines: ['LONI’s standards for professional and safe driving', 'on every trip.'],
    icon: <GaugeIcon />,
  },
  {
    title: 'Picking up a mother safely',
    lines: ['How to respectfully and safely assist a mother', 'into and out of the vehicle.'],
    icon: <MotherIcon />,
  },
  {
    title: 'Emergency transport expectations',
    lines: ['What to expect during an emergency trip and', 'how to respond appropriately.'],
    icon: <SirenIcon />,
  },
  {
    title: 'Driver safety',
    lines: ['Your personal safety and the safety of your', 'passenger during every trip.'],
    icon: <ShieldPersonIcon />,
  },
  {
    title: 'No direct payment',
    lines: ['Drivers never accept payment directly from', 'mothers. All payments come from LONI.'],
    icon: <MoneyBagIcon />,
  },
  {
    title: 'LONI payment rules',
    lines: ['How driver payments work and when to expect', 'them.'],
    icon: <MoneyBagIcon />,
  },
];

/** Three columns of 502 × 352 cards: x = 53 / 565 / 1076, rows at y = 341 / 706. */
const COL_X = [53, 565, 1076] as const;
const ROW_Y = [341, 706] as const;
const RECTS: Rect[] = TOPICS.map((_, i) => [COL_X[i % 3], ROW_Y[Math.floor(i / 3)], 502, 352]);

/** "We'll show you what you need to know before you drive": the six driver-training topics. */
export function TrainingSection() {
  return (
    <TopicGridSection
      id="driver-training"
      titleId="training-title"
      badge="Driver Training"
      heading={['We’ll show you what you need', 'to know before you drive.']}
      intro={[
        'LONI driver training prepares you to provide safe, professional and',
        'respectful support to every mother you transport.',
      ]}
      cta={{ label: 'Read more', href: SITE.driverTrainingHref }}
      topics={TOPICS}
      canvas={{
        w: 1630,
        h: 1140,
        badge: [56, 46],
        heading: [53, 154],
        headingSize: 42,
        headingLh: 53,
        intro: [991, 117, 620],
        introSize: 19.5,
        introLh: 37,
        rects: RECTS,
        cardFont: 16.5,
      }}
    />
  );
}
