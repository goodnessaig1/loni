import type { LegalSectionContent } from '../components/legal/LegalDocument';
import { LegalPage } from '../components/legal/LegalPage';

const SECTIONS: LegalSectionContent[] = [
  {
    title: 'Using LONI',
    paragraphs: [
      'LONI provides information and support for your maternity journey. You agree to use the app lawfully and responsibly, and not to misuse the services or interfere with other users.',
      'LONI is not a medical service. Always seek professional medical advice for any medical concern.',
    ],
  },
  {
    title: 'Subscriptions',
    paragraphs: [
      'LONI offers a free plan and a paid LONI Plus subscription. LONI Plus may be available as a 7-day free trial. When the trial ends, your subscription continues unless you cancel.',
      'You can manage or cancel your subscription through the app at any time.',
    ],
  },
  {
    title: 'Our responsibilities',
    paragraphs: [
      'We work to keep LONI reliable and secure, but we cannot guarantee uninterrupted availability. We are not liable for decisions made based on app content. LONI is provided "as is" to the extent permitted by law.',
    ],
  },
  {
    title: 'Changes to these terms',
    paragraphs: ["We may update these terms from time to time. We'll let you know about significant changes."],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      uppercase={false}
      lastUpdated="16th May, 2026"
      effectiveDate="16th May, 2026"
      intro="These terms govern your use of the LONI app and services. By using LONI, you agree to these terms. They are a general statement to be tailored to your actual terms."
      sections={SECTIONS}
    />
  );
}
