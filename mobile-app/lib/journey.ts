import { trimesterOf } from './pregnancy';

/** Typical head-to-heel length and weight by week (commonly published averages, rounded). */
const GROWTH: { week: number; length: string; weight: string; note: string }[] = [
  { week: 4, length: 'less than a centimetre', weight: 'almost nothing', note: 'The very first building blocks are forming.' },
  { week: 8, length: '0.6 inches', weight: 'less than 1 oz', note: 'Tiny fingers and toes are beginning to take shape.' },
  { week: 12, length: '2 inches', weight: '0.5 oz', note: 'Reflexes are starting and baby can open and close tiny fists.' },
  { week: 16, length: '4.5 inches', weight: '3.5 oz', note: 'Baby is making facial expressions and may be moving about.' },
  { week: 20, length: '10 inches', weight: '10 oz', note: 'Baby is swallowing and a coat of fine hair is forming.' },
  { week: 22, length: '11 inches', weight: '1 lb', note: 'Tiny eyebrows and lashes are forming this week.' },
  { week: 24, length: '12 inches', weight: '1.3 lb', note: 'Baby can hear sounds, and hearing keeps developing.' },
  { week: 28, length: '15 inches', weight: '2.2 lb', note: 'Baby can open their eyes and is putting on weight.' },
  { week: 32, length: '17 inches', weight: '3.8 lb', note: 'Bones are hardening and baby is practising breathing.' },
  { week: 36, length: '18.5 inches', weight: '5.8 lb', note: 'Baby is gaining weight fast and settling into position.' },
  { week: 40, length: '20 inches', weight: '7.6 lb', note: 'Baby is fully developed and ready to meet you.' },
];

/** "Baby is about 11 inches and 1 lb. Tiny eyebrows and lashes are forming this week." */
export function babyUpdate(week: number): string {
  const entry = [...GROWTH].reverse().find((g) => g.week <= Math.max(week, 4)) ?? GROWTH[0];
  const size = entry.weight === 'almost nothing' ? 'Baby is tiny.' : `Baby is about ${entry.length} and ${entry.weight}.`;
  return `${size} ${entry.note}`;
}

export interface ChangesForYou {
  text: string;
  chips: string[];
}

export function changesForYou(week: number): ChangesForYou {
  switch (trimesterOf(week)) {
    case 1:
      return {
        text: 'Tiredness and queasiness are common right now. Small, frequent meals and plenty of rest often help.',
        chips: ['Rest Often', 'Small Meals', 'Stay Hydrated'],
      };
    case 2:
      return {
        text: 'Your bump is growing. Skin may feel tight — moisturize and rest often.',
        chips: ['Stay Hydrated', 'Gentle Walks', 'Rest Often', 'Moisturize Skin'],
      };
    default:
      return {
        text: 'Your body is getting ready for birth. Swelling and backache are common, so put your feet up when you can.',
        chips: ['Rest Often', 'Gentle Walks', 'Count Kicks', 'Pack Hospital Bag'],
      };
  }
}

export const MILESTONES: { week: number; title: string }[] = [
  { week: 8, title: 'First heartbeat' },
  { week: 12, title: 'End of first trimester' },
  { week: 18, title: 'Anatomy scan' },
  { week: 22, title: 'Feel first kicks' },
  { week: 28, title: 'Glucose test' },
  { week: 36, title: 'Pack hospital bag' },
  { week: 40, title: 'Meet your baby' },
];

export type MilestoneState = 'done' | 'current' | 'upcoming';

export const milestoneState = (milestoneWeek: number, currentWeek: number): MilestoneState =>
  milestoneWeek < currentWeek ? 'done' : milestoneWeek === currentWeek ? 'current' : 'upcoming';
