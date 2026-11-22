import { JsonLd } from '../../components/seo/JsonLd';
import { pageMetadata } from '../../lib/seo/metadata';
import { pageGraph } from '../../lib/seo/jsonld';
import PrivacyPage from '../../views/PrivacyPage';

export const metadata = pageMetadata('privacy');

export default function Page() {
  return (
    <>
      <PrivacyPage />
      <JsonLd data={pageGraph('privacy')} />
    </>
  );
}
