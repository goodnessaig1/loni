import { useEffect, useId, useRef, useState } from 'react';
import { motion, useAnimationFrame, useInView, useReducedMotion } from 'framer-motion';

const PHRASE = 'Connecting you to a caring human voice...    ';
const FONT = '"Archivo Narrow", "Arial Narrow", sans-serif';

interface Props {
  /** Centre line of the ribbon (SVG path data, in `viewBox` units). */
  d: string;
  viewBox: string;
  strokeWidth: number;
  fontSize: number;
  /** Marquee speed in `viewBox` units per second. */
  speed?: number;
  color?: string;
}

/**
 * A pink band that follows `d` with a looping "Connecting you to a caring human voice…" marquee
 * running along it. The text is repeated far enough to cover the path and `startOffset` is advanced
 * by exactly one phrase length per cycle, so the loop is seamless. Drawing in/out of view is a
 * stroke reveal; the marquee only ticks while the ribbon is on screen.
 */
export function TextRibbon({ d, viewBox, strokeWidth, fontSize, speed = 70, color = '#D62D88' }: Props) {
  const pathId = `ribbon-${useId().replace(/:/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const guideRef = useRef<SVGPathElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const textPathRef = useRef<SVGTextPathElement>(null);
  const [layout, setLayout] = useState<{ period: number; repeats: number } | null>(null);
  const inView = useInView(svgRef, { margin: '200px' });
  const reduceMotion = useReducedMotion();

  // Needs the condensed face loaded, otherwise the phrase is measured in the fallback font.
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      const period = measureRef.current?.getComputedTextLength();
      const length = guideRef.current?.getTotalLength();
      if (!cancelled && period && length) setLayout({ period, repeats: Math.ceil(length / period) + 2 });
    };
    const fonts = document.fonts;
    if (fonts?.load) fonts.load(`700 ${fontSize}px "Archivo Narrow"`).then(measure, measure);
    else measure();
    return () => {
      cancelled = true;
    };
  }, [d, fontSize]);

  useAnimationFrame((t) => {
    if (!inView || reduceMotion || !layout) return;
    const offset = -(((t / 1000) * speed) % layout.period);
    textPathRef.current?.setAttribute('startOffset', offset.toFixed(2));
  });

  const textStyle = { fontFamily: FONT, fontWeight: 700, fontSize } as const;

  return (
    <motion.svg
      ref={svgRef}
      viewBox={viewBox}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.15 }}
    >
      <defs>
        <path id={pathId} ref={guideRef} d={d} fill="none" />
      </defs>

      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        variants={{
          hide: { pathLength: 0, transition: { duration: 0.4 } },
          show: { pathLength: 1, transition: { duration: 1.6, ease: [0.22, 1, 0.36, 1] } },
        }}
      />

      <text ref={measureRef} style={{ ...textStyle, opacity: 0 }}>
        {PHRASE}
      </text>

      <motion.text
        fill="#fff"
        dy={fontSize * 0.34}
        style={textStyle}
        variants={{ hide: { opacity: 0, transition: { duration: 0.2 } }, show: { opacity: 1, transition: { duration: 0.6, delay: 0.7 } } }}
      >
        <textPath ref={textPathRef} href={`#${pathId}`} startOffset={0}>
          {layout ? PHRASE.repeat(layout.repeats) : PHRASE}
        </textPath>
      </motion.text>
    </motion.svg>
  );
}
