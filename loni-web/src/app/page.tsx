import { JsonLd } from '../components/seo/JsonLd';
import { pageMetadata } from '../lib/seo/metadata';
import { pageGraph } from '../lib/seo/jsonld';
import HomePage from '../views/HomePage';

export const metadata = pageMetadata('home');

export default function Page() {
  return (
    <>
      <HomePage />
      <JsonLd data={pageGraph('home')} />
    </>
  );
}
