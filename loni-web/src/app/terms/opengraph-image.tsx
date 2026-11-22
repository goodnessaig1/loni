import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '../../lib/seo/og';
import { ROUTES } from '../../lib/seo/routes';

export const alt = ROUTES.terms.title;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage(ROUTES.terms.ogHeadline);
}
