import { JsonLd } from '../../components/seo/JsonLd';
import { pageMetadata } from '../../lib/seo/metadata';
import { pageGraph } from '../../lib/seo/jsonld';
import AboutPage from '../../views/AboutPage';

export const metadata = pageMetadata('about');

export default function Page() {
  return (
    <>
      <AboutPage />
      <JsonLd data={pageGraph('about')} />
    </>
  );
}
