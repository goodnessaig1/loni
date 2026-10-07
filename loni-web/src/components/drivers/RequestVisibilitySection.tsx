import requestCard from '../../assets/drivers/request-card.webp';
import { DetailSection } from './DetailSection';

/** "Know the trip before you take it": detail list on the left, the Emergency Request screen on the right. */
export function RequestVisibilitySection() {
  return (
    <DetailSection
      id="request-visibility"
      titleId="request-visibility-title"
      badge="Request Visibility"
      heading={['Know the trip before', 'you take it.']}
      intro={[
        'Before you accept any request, you can see exactly what the trip',
        'involves. No surprises, you choose the trips that work for you.',
      ]}
      details={[
        { title: 'Pickup location', text: 'See exactly where the mother needs to be collected.' },
        { title: 'Destination', text: 'The hospital or maternity centre the mother is going to.' },
        { title: 'Distance', text: 'Know how far the trip is before you commit.' },
        { title: 'Estimated trip duration', text: 'Understand how long the trip will take.' },
        { title: 'Driver payout', text: 'See your earnings for the trip before you accept.' },
      ]}
      card={{
        src: requestCard,
        alt: "The LONI driver app's Emergency Request screen showing the mother, pickup, destination, distance and payout",
      }}
      canvas={{
        w: 1618,
        h: 1240,
        badge: [55, 30],
        heading: [52, 138],
        intro: [983, 171],
        list: [52, 396, 691],
        card: [820, 359, 747],
        headingSize: 42,
        headingLh: 53,
        introSize: 19.5,
        introLh: 37,
      }}
    />
  );
}
