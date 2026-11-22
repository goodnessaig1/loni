import { JsonLd } from '../../components/seo/JsonLd';
import { pageMetadata } from '../../lib/seo/metadata';
import { pageGraph } from '../../lib/seo/jsonld';
import DisclaimerPage from '../../views/DisclaimerPage';

export const metadata = pageMetadata('disclaimer');

export default function Page() {
  return (
    <>
      <DisclaimerPage />
      <JsonLd data={pageGraph('disclaimer')} />
    </>
  );
}
