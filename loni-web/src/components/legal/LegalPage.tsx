import { PageShell } from '../layout/PageShell';
import { LegalDocument } from './LegalDocument';

type Props = Parameters<typeof LegalDocument>[0];

/** A full legal page: site header, the document, site footer. */
export function LegalPage(props: Props) {
  return (
    <PageShell>
      <LegalDocument {...props} />
    </PageShell>
  );
}
