/**
 * In-app Privacy Policy and Terms of Service. Kept in step with the website
 * (loni-web/src/pages/PrivacyPage.tsx, TermsPage.tsx). PLACEHOLDER WORDING:
 * have counsel review both (Nigeria's NDPA applies) before release.
 */
export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; paragraphs: string[] }[];
}

export const LEGAL: Record<'privacy' | 'terms', LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: '16 May 2026',
    intro: 'We care about your privacy. This policy explains how LONI collects, uses and protects the personal information of nurses, drivers and support partners who use LONI Server.',
    sections: [
      { title: 'Information we collect', paragraphs: [
        'Information you give us: your name, contact details, profile photo, and the documents you upload for verification (for example a nursing licence, driver’s licence or vehicle papers).',
        'Information created as you use the app: call and trip history, ratings, your online status and, while you are available or on a trip, your device location.',
        'Limited technical information (device type, app version, push token) so the app works securely and can reach you.',
      ] },
      { title: 'How we use your information', paragraphs: [
        'To verify your account, connect you with mothers who need help, dispatch and track emergency rides, and keep a record of the support you provided.',
        'A mother sees your name, photo and, for drivers, your vehicle and live location during her ride. A support partner only sees what the mother chose to share with them.',
        'We do not sell your personal information. We only share it with providers who help us run LONI (hosting, maps, notifications, email), and only as needed.',
      ] },
      { title: 'Location', paragraphs: [
        'Drivers: we use your location while you are online to offer nearby requests, and during a trip to guide you and show the mother where you are. You can go offline at any time.',
      ] },
      { title: 'Security', paragraphs: [
        'We take reasonable measures to protect your information, and treat health-related information about mothers with particular care. No system is completely secure, but we work hard to keep your data safe.',
      ] },
      { title: 'Your rights', paragraphs: [
        'You can view and update your profile at any time. You can ask us to correct or delete your information, or to close your account, by contacting support from the app.',
      ] },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: '16 May 2026',
    intro: 'These terms apply to nurses, drivers and support partners using LONI Server. By using the app you agree to them.',
    sections: [
      { title: 'Your account', paragraphs: [
        'Give accurate information and keep your login details private. Nurse and driver accounts are reviewed before they become active, and we may suspend an account that breaks these terms or puts mothers at risk.',
      ] },
      { title: 'Nurses', paragraphs: [
        'You confirm you hold a valid nursing licence. LONI connects you with mothers for support and guidance by voice; you remain responsible for the advice you give and should direct a mother to emergency care whenever her situation needs it.',
      ] },
      { title: 'Drivers', paragraphs: [
        'You confirm you hold a valid driver’s licence and that your vehicle is roadworthy, registered and insured. Drive safely and lawfully. LONI is not an ambulance service; in a life-threatening emergency a mother should also call emergency services.',
      ] },
      { title: 'Support partners', paragraphs: [
        'You see only what the mother chooses to share with you, and she can change or stop sharing at any time. Use what you see only to support her.',
      ] },
      { title: 'Conduct', paragraphs: [
        'Treat every mother with respect and keep what you learn about her confidential. Do not record calls or share her information outside LONI.',
      ] },
      { title: 'Changes and contact', paragraphs: [
        'We may update these terms and will tell you in the app when we do. Questions? Contact support from the app.',
      ] },
    ],
  },
};
