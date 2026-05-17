import React from 'react';

/**
 * Знак ранга — погон-кружок с накладной геральдикой.
 * Заменяет эмодзи 🌟⭐🎖🪖🙂 в системе рефералов.
 */

export type RankTier =
  | 'crown'         // EMPEROR — корона
  | 'wreath'        // MARSHAL — лавровый венок + звезда
  | 'bigStar'       // generals — крупная звезда × N (N=1..3)
  | 'medal'         // BRIGADIER — медаль
  | 'midStar'       // colonels — средняя звезда × N (N=1..3)
  | 'dot'           // captain/lieutenants — точка × N (N=1..4) на голубом фоне
  | 'rhombus'       // WARRANT — золотистый ромб
  | 'rhombusBlue'   // SERGEANT — синий ромб
  | 'dotBlue'       // CORPORAL — одиночная синяя точка
  | 'helmet'        // PRIVATE — каска
  | 'recruit';      // RECRUIT — силуэт

const TIER_PALETTE: Record<RankTier, { bg: string; ring: string; fg: string }> = {
  crown:       { bg: 'rgba(212,168,67,.18)', ring: 'rgba(240,200,90,.55)', fg: '#F0C85A' },
  wreath:      { bg: 'rgba(212,168,67,.14)', ring: 'rgba(240,200,90,.5)',  fg: '#F0C85A' },
  bigStar:     { bg: 'rgba(212,168,67,.12)', ring: 'rgba(240,200,90,.4)',  fg: '#F0C85A' },
  medal:       { bg: 'rgba(212,168,67,.1)',  ring: 'rgba(240,200,90,.32)', fg: '#E8B850' },
  midStar:     { bg: 'rgba(220,140,40,.1)',  ring: 'rgba(220,140,40,.32)', fg: '#E89740' },
  dot:         { bg: 'rgba(72,140,220,.1)',  ring: 'rgba(72,140,220,.35)', fg: '#7AB4F0' },
  rhombus:     { bg: 'rgba(212,168,67,.08)', ring: 'rgba(212,168,67,.28)', fg: '#D4A843' },
  rhombusBlue: { bg: 'rgba(72,140,220,.08)', ring: 'rgba(72,140,220,.28)', fg: '#7AB4F0' },
  dotBlue:     { bg: 'rgba(72,140,220,.07)', ring: 'rgba(72,140,220,.22)', fg: '#7AB4F0' },
  helmet:      { bg: 'rgba(120,130,110,.1)', ring: 'rgba(150,160,140,.3)', fg: '#A8B098' },
  recruit:     { bg: 'rgba(120,120,130,.08)',ring: 'rgba(150,150,160,.25)',fg: '#9098A8' },
};

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  // Простая 5-конечная звезда вокруг (cx,cy)
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (-Math.PI / 2) + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${cx + Math.cos(angle) * rad},${cy + Math.sin(angle) * rad}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}

export const RankBadge: React.FC<{ tier: RankTier; count?: number; size?: number }> = ({
  tier, count = 1, size = 36,
}) => {
  const pal = TIER_PALETTE[tier];
  const inner: React.ReactNode[] = [];

  if (tier === 'crown') {
    // Корона: трапеция с 3 зубцами и точками
    inner.push(
      <path key="c" d="M8 22 L24 22 L24 16 L20 19 L16 12 L12 19 L8 16 Z" fill={pal.fg} />,
      <circle key="d1" cx={12} cy={16} r={1.6} fill={pal.fg} />,
      <circle key="d2" cx={16} cy={12} r={1.8} fill={pal.fg} />,
      <circle key="d3" cx={20} cy={16} r={1.6} fill={pal.fg} />,
      <rect key="b" x={7} y={23} width={18} height={2.4} fill={pal.fg} rx={1} />,
    );
  } else if (tier === 'wreath') {
    // Лавровый венок (две дуги) + звезда по центру
    inner.push(
      <path key="l" d="M8 22 Q4 16 8 10" stroke={pal.fg} strokeWidth={2} fill="none" strokeLinecap="round" />,
      <path key="r" d="M24 22 Q28 16 24 10" stroke={pal.fg} strokeWidth={2} fill="none" strokeLinecap="round" />,
      <Star key="s" cx={16} cy={17} r={6} fill={pal.fg} />,
    );
  } else if (tier === 'bigStar') {
    const n = Math.max(1, Math.min(3, count));
    if (n === 1) inner.push(<Star key="s" cx={16} cy={16} r={9} fill={pal.fg} />);
    else if (n === 2) {
      inner.push(<Star key="s1" cx={11} cy={16} r={6} fill={pal.fg} />);
      inner.push(<Star key="s2" cx={21} cy={16} r={6} fill={pal.fg} />);
    } else {
      inner.push(<Star key="s1" cx={16} cy={10} r={5.5} fill={pal.fg} />);
      inner.push(<Star key="s2" cx={10} cy={20} r={5.5} fill={pal.fg} />);
      inner.push(<Star key="s3" cx={22} cy={20} r={5.5} fill={pal.fg} />);
    }
  } else if (tier === 'medal') {
    // Колодка + диск
    inner.push(
      <rect key="rb" x={11} y={4} width={10} height={6} fill={pal.fg} opacity={0.6} />,
      <circle key="d" cx={16} cy={19} r={8} fill={pal.fg} />,
      <Star key="s" cx={16} cy={19} r={4} fill="rgba(0,0,0,.45)" />,
    );
  } else if (tier === 'midStar') {
    const n = Math.max(1, Math.min(3, count));
    const positions = n === 1 ? [[16, 16, 6]] : n === 2 ? [[11, 16, 4.5], [21, 16, 4.5]] : [[8, 16, 4], [16, 16, 4], [24, 16, 4]];
    positions.forEach(([cx, cy, r], i) =>
      inner.push(<Star key={i} cx={cx} cy={cy} r={r} fill={pal.fg} />),
    );
  } else if (tier === 'dot') {
    const n = Math.max(1, Math.min(4, count));
    const layouts: Record<number, [number, number][]> = {
      1: [[16, 16]],
      2: [[12, 16], [20, 16]],
      3: [[10, 16], [16, 16], [22, 16]],
      4: [[10, 12], [22, 12], [10, 22], [22, 22]],
    };
    layouts[n].forEach(([cx, cy], i) =>
      inner.push(<circle key={i} cx={cx} cy={cy} r={2.6} fill={pal.fg} />),
    );
  } else if (tier === 'rhombus' || tier === 'rhombusBlue') {
    inner.push(<polygon key="rh" points="16,8 24,16 16,24 8,16" fill={pal.fg} />);
  } else if (tier === 'dotBlue') {
    inner.push(<circle key="d" cx={16} cy={16} r={5} fill={pal.fg} />);
  } else if (tier === 'helmet') {
    // Каска — полукруг + ободок
    inner.push(
      <path key="h" d="M7 20 Q7 10 16 10 Q25 10 25 20 Z" fill={pal.fg} />,
      <rect key="b" x={6} y={20} width={20} height={2.4} fill={pal.fg} rx={1} />,
    );
  } else if (tier === 'recruit') {
    // Силуэт головы + плечи
    inner.push(
      <circle key="h" cx={16} cy={13} r={4} fill={pal.fg} />,
      <path key="b" d="M8 24 Q8 18 16 18 Q24 18 24 24 Z" fill={pal.fg} />,
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: 'block' }}
      aria-hidden
    >
      <circle cx={16} cy={16} r={15} fill={pal.bg} stroke={pal.ring} strokeWidth={1} />
      {inner}
    </svg>
  );
};
