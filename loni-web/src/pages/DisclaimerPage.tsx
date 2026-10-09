import type { LegalSectionContent } from '../components/legal/LegalDocument';
import { LegalPage } from '../components/legal/LegalPage';

const SECTIONS: LegalSectionContent[] = [
  {
    title: 'Not medical advice',
    paragraphs: [
      'LONI provides support and information and is not a substitute for professional medical advice, diagnosis or treatment. Always seek the advice of your physician, midwife or other qualified health provider with any questions you may have regarding a medical condition.',
      "Never disregard professional medical advice or delay seeking it because of something you've read or seen in LONI.",
    ],
  },
  {
    title: 'AI guidance vs professional care',
    paragraphs: [
      "LUMA is an AI companion that offers guidance and information. It does not replace your doctor, nurse or emergency medical care. We're always clear about the difference between AI guidance and professional care.",
    ],
  },
  {
    title: 'Emergencies',
    paragraphs: [
      'If you are experiencing a medical emergency, contact your local emergency service or seek immediate medical care. LONI is not an ambulance or an emergency medical service.',
    ],
  },
  {
    title: 'Third-party providers',
    paragraphs: [
      'LONI connects you with verified nurses and drivers, and lets you save preferred hospitals. LONI does not own or operate these hospitals, and nurse support does not replace your own healthcare team.',
    ],
  },
];

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Medical Disclaimer"
      uppercase={false}
      lastUpdated="16th May, 2026"
      effectiveDate="16th May, 2026"
      intro="LONI is here to support you — but it is not a substitute for professional medical care. Please read this important information."
      sections={SECTIONS}
    />
  );
}
