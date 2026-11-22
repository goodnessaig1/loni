import type { MetadataRoute } from 'next';
import { SITE } from '../config/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} – ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: SITE.themeColor,
    lang: 'en',
    categories: ['health', 'medical', 'lifestyle'],
    icons: [{ src: '/fav.png', sizes: '168x168', type: 'image/png', purpose: 'any' }],
  };
}
