import type { LegalSectionContent } from '../components/legal/LegalDocument';
import { LegalPage } from '../components/legal/LegalPage';
import { SITE } from '../config/site';

const SECTIONS: LegalSectionContent[] = [
  {
    title: 'Information we collect',
    paragraphs: [
      'LONI may collect information you provide directly, such as your name, contact details, pregnancy-related information you choose to share, and your preferences within the app.',
      'We may also collect limited technical information to keep the app working securely and smoothly.',
    ],
  },
  {
    title: 'How we use your information',
    paragraphs: [
      "We use your information to provide and improve LONI's services, personalise your experience, respond to your requests, and keep you informed about your subscription.",
      'We do not sell your personal information. We only share it with trusted providers who help us operate LONI, and only as needed.',
    ],
  },
  {
    title: 'Security',
    paragraphs: [
      'We take reasonable measures to protect your information. Your health-related data is treated with particular care. While no system is completely secure, we work hard to keep your data safe.',
    ],
  },
  {
    title: 'Your choices',
    paragraphs: [
      <>
        You can access, correct or request deletion of your information through the app or by contacting us through{' '}
        <a
          href={SITE.supportHref}
          className="text-[#4CAF2E] underline underline-offset-2 transition-colors hover:text-[#2f7a17]"
        >
          support.
        </a>
      </>,
    ],
  },
  {
    title: 'Your Rights',
    paragraphs: [
      'You have the right to access, correct, and delete your personal information. You can view and update your profile at any time from your portal. If you want your account and its data removed, contact us using the details below and we will help.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="16th May, 2026"
      effectiveDate="16th May, 2026"
      intro="We care about your privacy. This policy explains how LONI collects, uses and protects your personal information. It is a general statement to be tailored to your actual practices."
      sections={SECTIONS}
    />
  );
}
