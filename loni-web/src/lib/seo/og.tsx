import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE } from '../../config/site';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/** Branded 1200×630 social card: logo, page headline and the site tagline on the hero's pink. */
export async function renderOgImage(headline: string, kicker = 'Pregnancy · Birth · Postpartum') {
  const logo = await readFile(join(process.cwd(), 'src/assets/og/logo.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #fdf0f4 0%, #fbd3e6 55%, #f7389d 140%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={200} height={126} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#d62d88', textTransform: 'uppercase', letterSpacing: 1 }}>
            {kicker}
          </div>
          <div style={{ marginTop: 16, fontSize: 72, fontWeight: 700, lineHeight: 1.05, color: '#000', maxWidth: 980 }}>
            {headline}
          </div>
        </div>
        <div style={{ fontSize: 28, color: '#344054' }}>
          {`${SITE.url.replace(/^https?:\/\//, '')} · ${SITE.tagline}`}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
