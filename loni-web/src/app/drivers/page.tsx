import { JsonLd } from '../../components/seo/JsonLd';
import { pageMetadata } from '../../lib/seo/metadata';
import { pageGraph } from '../../lib/seo/jsonld';
import DriversPage from '../../views/DriversPage';

export const metadata = pageMetadata('drivers');

export default function Page() {
  return (
    <>
      <DriversPage />
      <JsonLd data={pageGraph('drivers')} />
    </>
  );
}
