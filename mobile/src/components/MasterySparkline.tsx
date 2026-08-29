import React from 'react';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { colors } from '../theme';

interface MasterySparklineProps {
  /** Mastery % per past session, oldest → newest. Needs ≥2 points to render. */
  data: number[];
  width?: number;
  height?: number;
}

/**
 * Tiny sparkline for session-history mastery: just a line + a very light area
 * fill + a dot on the last point. No axes, no labels. The parent
 * (`MasteryHero`) is responsible for hiding this entirely when there are fewer
 * than 2 data points (never invent a trend from one or zero sessions).
 */
export function MasterySparkline({ data, width = 58, height = 20 }: MasterySparklineProps) {
  if (data.length < 2) return null;

  const pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - 2 * pad);
    const y = height - pad - ((v - min) / range) * (height - 2 * pad);
    return [x, y] as [number, number];
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1][0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={areaPath} fill={colors.brandGreen} opacity={0.08} />
      <Path
        d={linePath}
        fill="none"
        stroke={colors.brandGreen}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgCircle cx={last[0]} cy={last[1]} r={2} fill={colors.brandGreen} />
    </Svg>
  );
}
