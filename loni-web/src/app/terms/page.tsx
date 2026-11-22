import { JsonLd } from '../../components/seo/JsonLd';
import { pageMetadata } from '../../lib/seo/metadata';
import { pageGraph } from '../../lib/seo/jsonld';
import TermsPage from '../../views/TermsPage';

export const metadata = pageMetadata('terms');

export default function Page() {
  return (
    <>
      <TermsPage />
      <JsonLd data={pageGraph('terms')} />
    </>
  );
}
