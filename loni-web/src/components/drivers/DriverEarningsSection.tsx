import earningsCard from '../../assets/drivers/earnings-card.webp';
import { DetailSection } from './DetailSection';

/** "We make getting paid one less thing to worry about": the Payment Details screen on the left, the payout steps on the right. */
export function DriverEarningsSection() {
  return (
    <DetailSection
      id="driver-earnings"
      titleId="driver-earnings-title"
      badge="Driver Earnings"
      heading={['We make getting paid one less', 'thing to worry about.']}
      intro={[
        'LONI handles payment for completed trips. Add your bank details',
        'and receive payment from LONI admin after successful trips.',
      ]}
      details={[
        { title: 'Add bank details', text: 'Set up your payment information in LONI Server once.' },
        { title: 'Complete trip', text: 'Finish the trip and mark it complete through LONI Server.' },
        { title: 'Payment becomes pending', text: 'Your earnings for the completed trip enter pending status.' },
        { title: 'LONI processes payment', text: 'The LONI admin reviews and processes the payment.' },
        { title: 'Added to driver earnings', text: 'Payment is added to your driver earnings account.' },
      ]}
      card={{
        src: earningsCard,
        alt: "The LONI driver app's Payment Details screen asking for account name, bank name and account number",
      }}
      canvas={{
        w: 1602,
        h: 1300,
        badge: [51, 48],
        heading: [48, 155],
        intro: [973, 188],
        list: [853, 365, 686],
        card: [48, 363, 740],
        headingSize: 42,
        headingLh: 53,
        introSize: 19.5,
        introLh: 37,
      }}
    />
  );
}
