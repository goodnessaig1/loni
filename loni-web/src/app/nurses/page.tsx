import { JsonLd } from '../../components/seo/JsonLd';
import { pageMetadata } from '../../lib/seo/metadata';
import { pageGraph } from '../../lib/seo/jsonld';
import NursesPage from '../../views/NursesPage';

export const metadata = pageMetadata('nurses');

export default function Page() {
  return (
    <>
      <NursesPage />
      <JsonLd data={pageGraph('nurses')} />
    </>
  );
}
