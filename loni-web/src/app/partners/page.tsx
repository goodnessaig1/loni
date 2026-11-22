import { JsonLd } from '../../components/seo/JsonLd';
import { pageMetadata } from '../../lib/seo/metadata';
import { pageGraph } from '../../lib/seo/jsonld';
import PartnersPage from '../../views/PartnersPage';

export const metadata = pageMetadata('partners');

export default function Page() {
  return (
    <>
      <PartnersPage />
      <JsonLd data={pageGraph('partners')} />
    </>
  );
}
