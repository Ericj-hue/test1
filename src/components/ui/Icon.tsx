/**
 * A small built-in icon set drawn with SVG strokes (24 x 24 grid).
 * Drawing icons as vectors keeps the app free of icon fonts: nothing to
 * download, nothing to load at start-up, and identical on every platform.
 */
import Svg, { Path } from 'react-native-svg';

const line = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}L${x2} ${y2}`;
const poly = (...points: number[]) => {
  let d = '';
  for (let i = 0; i < points.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${points[i]} ${points[i + 1]}`;
  return d;
};
const closed = (...points: number[]) => `${poly(...points)}Z`;
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}` +
  `a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
const dot = (x: number, y: number) => line(x, y, x + 0.01, y);

const ICONS = {
  back: poly(15, 18, 9, 12, 15, 6),
  forward: poly(9, 18, 15, 12, 9, 6),
  up: poly(18, 15, 12, 9, 6, 15),
  down: poly(6, 9, 12, 15, 18, 9),
  plus: line(12, 5, 12, 19) + line(5, 12, 19, 12),
  minus: line(5, 12, 19, 12),
  close: line(18, 6, 6, 18) + line(6, 6, 18, 18),
  check: poly(20, 6, 9, 17, 4, 12),
  undo: poly(1, 4, 1, 10, 7, 10) + 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
  restart: poly(23, 4, 23, 10, 17, 10) + 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10',
  more: dot(12, 12) + dot(19, 12) + dot(5, 12),
  settings:
    line(4, 21, 4, 14) + line(4, 10, 4, 3) + line(12, 21, 12, 12) + line(12, 8, 12, 3) + line(20, 21, 20, 16) +
    line(20, 12, 20, 3) + line(1, 14, 7, 14) + line(9, 8, 15, 8) + line(17, 16, 23, 16),
  users:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' + circle(9, 7, 4) + 'M23 21v-2a4 4 0 0 0-3-3.87' +
    'M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' + circle(12, 7, 4),
  userPlus: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' + circle(8.5, 7, 4) + line(20, 8, 20, 14) + line(23, 11, 17, 11),
  clock: circle(12, 12, 10) + poly(12, 6, 12, 12, 16, 14),
  stats: line(18, 20, 18, 10) + line(12, 20, 12, 4) + line(6, 20, 6, 14),
  award: circle(12, 8, 7) + poly(8.21, 13.89, 7, 23, 12, 20, 17, 23, 15.79, 13.88),
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' + poly(16, 6, 12, 2, 8, 6) + line(12, 2, 12, 15),
  copy: rect(9, 9, 13, 13, 2) + 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  image: rect(3, 3, 18, 18, 2) + circle(8.5, 8.5, 1.5) + poly(21, 15, 16, 10, 5, 21),
  trash:
    poly(3, 6, 5, 6, 21, 6) + 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' +
    line(10, 11, 10, 17) + line(14, 11, 14, 17),
  edit: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  play: closed(5, 3, 19, 12, 5, 21),
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' + line(4, 22, 4, 15),
  alert:
    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' + line(12, 9, 12, 13) +
    dot(12, 17),
  info: circle(12, 12, 10) + line(12, 16, 12, 12) + dot(12, 8),
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' + 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  sound: closed(11, 5, 6, 9, 2, 9, 2, 15, 6, 15, 11, 19) + 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07',
  phone: rect(5, 2, 14, 20, 2) + dot(12, 18),
  sun:
    circle(12, 12, 5) + line(12, 1, 12, 3) + line(12, 21, 12, 23) + line(4.22, 4.22, 5.64, 5.64) +
    line(18.36, 18.36, 19.78, 19.78) + line(1, 12, 3, 12) + line(21, 12, 23, 12) + line(4.22, 19.78, 5.64, 18.36) +
    line(18.36, 5.64, 19.78, 4.22),
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  shuffle:
    poly(16, 3, 21, 3, 21, 8) + line(4, 20, 21, 3) + poly(21, 16, 21, 21, 16, 21) + line(15, 15, 21, 21) +
    line(4, 4, 9, 9),
  swap: poly(17, 1, 21, 5, 17, 9) + 'M3 11V9a4 4 0 0 1 4-4h14' + poly(7, 23, 3, 19, 7, 15) + 'M21 13v2a4 4 0 0 1-4 4H3',
  exit: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' + poly(16, 17, 21, 12, 16, 7) + line(21, 12, 9, 12),
  endTurn: closed(5, 4, 15, 12, 5, 20) + line(19, 5, 19, 19),
  arrowUp: line(12, 19, 12, 5) + poly(5, 12, 12, 5, 19, 12),
  arrowDown: line(12, 5, 12, 19) + poly(19, 12, 12, 19, 5, 12),
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' + poly(9, 22, 9, 12, 15, 12, 15, 22),
  bolt: closed(13, 2, 3, 14, 12, 14, 11, 22, 21, 10, 12, 10),
  target: circle(12, 12, 10) + circle(12, 12, 6) + circle(12, 12, 2),
  save:
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' + poly(17, 21, 17, 13, 7, 13, 7, 21) +
    poly(7, 3, 7, 8, 15, 8),
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' + poly(7, 10, 12, 15, 17, 10) + line(12, 15, 12, 3),
  screen: rect(2, 3, 20, 14, 2) + line(8, 21, 16, 21) + line(12, 17, 12, 21),
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={ICONS[name]}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
