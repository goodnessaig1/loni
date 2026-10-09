import nightDriver from '../../assets/drivers/night-driver.webp';
import { WhySection } from '../roles/WhySection';

/** "Why Drivers Matter": the shared "why it matters" block with the driver copy and the night-time photo. */
export function WhyDriversSection() {
  return (
    <WhySection
      id="why-drivers"
      titleId="why-drivers-title"
      badge="Why Drivers Matter"
      statement={[
        'LONI helps connect mothers with',
        'transportation when they need help getting',
        'to their chosen hospital. As a verified LONI',
        "driver, you play a real role in a mother's",
        'journey when it matters most.',
      ]}
      cards={[
        { title: ['Be there when it', 'counts'], text: ['Help mothers reach their hospital', 'safely and with confidence.'] },
        { title: ['Verified and', 'trusted'], text: ['LONI verifies all drivers before they', 'can accept requests.'] },
        { title: ['Earn through', 'LONI'], text: ['Complete trips and receive payment', 'directly from LONI admin.'] },
      ]}
      photo={{
        src: nightDriver,
        alt: 'A LONI driver at night, city lights reflected in the car window',
        width: 1408,
        height: 1145,
      }}
      canvas={{
        w: 1663,
        h: 900,
        badge: [55, 70],
        avatars: [53, 190],
        stat: [53, 262],
        statement: [711, 79],
        statementSize: 41.5,
        statementLh: 54.5,
        cardsX: [53, 381],
        cardsY: 466,
        card: [361, 326],
        cardFont: 16,
        photo: [1195, 460, 415, 337],
      }}
    />
  );
}
