import appHome from '../../assets/nurses/app-home.webp';
import { DetailSection } from '../drivers/DetailSection';

/** "We're with you from application to your first call": the six onboarding steps beside the nurse app home screen. */
export function NurseHowItWorksSection() {
  return (
    <DetailSection
      id="how-it-works"
      titleId="nurse-how-it-works-title"
      badge="How It Works"
      heading={['We’re with you from', 'application to your first call.']}
      details={[
        { title: 'Apply', text: 'Submit your application to join LONI as a nurse.' },
        { title: 'Complete nurse onboarding', text: 'Provide your professional information and complete the onboarding process.' },
        { title: 'Verification', text: 'LONI reviews and verifies your information and credentials.' },
        { title: 'Become available', text: 'Once approved, activate your availability through LONI Server.' },
        { title: 'Receive call request', text: "Incoming requests from mothers appear when you're available." },
        { title: 'Talk with mother', text: 'Have a real voice conversation and provide appropriate support.' },
      ]}
      card={{
        src: appHome,
        alt: "The LONI nurse app home screen: a verified nurse is online and sees her incoming requests",
      }}
      canvas={{
        w: 1647,
        h: 1335,
        badge: [61, 47],
        heading: [58, 157],
        list: [57, 388, 703],
        card: [840, 351, 759],
        headingSize: 42,
        headingLh: 54,
        listFont: 16.9,
      }}
    />
  );
}
