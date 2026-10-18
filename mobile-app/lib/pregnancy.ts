import type { User } from '../context/AuthContext';

const DAY_MS = 24 * 60 * 60 * 1000;
const FULL_TERM_DAYS = 280; // 40 weeks

/** Fruit / vegetable size comparison per gestational week (week 4 and below share the first entry). */
const SIZE_BY_WEEK: Record<number, string> = {
  4: 'a Poppy Seed', 5: 'a Sesame Seed', 6: 'a Lentil', 7: 'a Blueberry', 8: 'a Raspberry', 9: 'a Cherry',
  10: 'a Strawberry', 11: 'a Fig', 12: 'a Lime', 13: 'a Lemon', 14: 'a Peach', 15: 'an Apple', 16: 'an Avocado',
  17: 'a Pear', 18: 'a Bell Pepper', 19: 'a Mango', 20: 'a Banana', 21: 'a Carrot', 22: 'a Papaya',
  23: 'a Grapefruit', 24: 'a Cantaloupe', 25: 'a Cauliflower', 26: 'a Head of Lettuce', 27: 'an Ear of Corn',
  28: 'an Eggplant', 29: 'a Butternut Squash', 30: 'a Cabbage', 31: 'a Coconut', 32: 'a Jicama', 33: 'a Pineapple',
  34: 'a Cantaloupe', 35: 'a Honeydew Melon', 36: 'a Head of Romaine', 37: 'a Bunch of Swiss Chard', 38: 'a Leek',
  39: 'a Mini Watermelon', 40: 'a Small Pumpkin',
};

export const babySize = (week: number): string => SIZE_BY_WEEK[Math.min(Math.max(week, 4), 40)];

export const trimesterOf = (week: number): 1 | 2 | 3 => (week <= 12 ? 1 : week <= 27 ? 2 : 3);

export const recoveryStageOf = (week: number): 'early' | 'active' | 'extended' =>
  week <= 6 ? 'early' : week <= 12 ? 'active' : 'extended';

const parseNumber = (raw?: string | null): number | null => {
  if (raw == null) return null;
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
};

export interface PregnancyProgress {
  kind: 'pregnant' | 'postpartum';
  /** Gestational week (pregnant) or weeks since birth (postpartum). */
  week: number;
  /** Whole days until the due date, never negative. `null` when it can't be worked out or for postpartum. */
  daysUntilDue: number | null;
}

/** Derives progress from the user profile; `null` when there is nothing to base it on. */
export function getPregnancyProgress(user: User | null | undefined, now = Date.now()): PregnancyProgress | null {
  if (!user) return null;

  // Loni is for every woman: someone who is not pregnant has no pregnancy progress to show.
  if (user.status === 'general' || user.status === 'ttc') return null;

  if (user.status === 'newMom') {
    const week = parseNumber(user.babyAge);
    return week == null ? null : { kind: 'postpartum', week, daysUntilDue: null };
  }

  const week = parseNumber(user.pregnancyWeek);
  if (week == null) return null;

  let daysUntilDue: number;
  if (user.pregnancyStartDate) {
    const due = new Date(user.pregnancyStartDate).getTime() + FULL_TERM_DAYS * DAY_MS;
    daysUntilDue = Math.ceil((due - now) / DAY_MS);
  } else {
    daysUntilDue = (40 - week) * 7;
  }
  return { kind: 'pregnant', week, daysUntilDue: Math.max(daysUntilDue, 0) };
}

export interface DailyTip {
  icon: 'droplet' | 'moon' | 'heart' | 'coffee' | 'activity' | 'sun' | 'smile' | 'book-open' | 'shield' | 'phone';
  title: string;
  body: string;
}

const PREGNANCY_TIPS: DailyTip[] = [
  { icon: 'droplet', title: 'Hydration matters', body: 'Try to drink 8–10 cups of water a day. Add a slice of lemon if plain water feels boring.' },
  { icon: 'moon', title: 'Rest when you can', body: 'Short naps and an earlier bedtime help your body keep up with everything it is doing.' },
  { icon: 'activity', title: 'Keep gently moving', body: 'A 20-minute walk most days can ease back pain and lift your mood. Listen to your body.' },
  { icon: 'coffee', title: 'Small, steady meals', body: 'Eating little and often can calm nausea and heartburn. Keep a snack within reach.' },
  { icon: 'heart', title: 'Count the kicks', body: 'Once you feel regular movement, notice your baby’s pattern and tell your nurse about any big change.' },
  { icon: 'smile', title: 'Be kind to yourself', body: 'Mood swings are normal. Talk to someone you trust, or reach out to a nurse any time.' },
  { icon: 'book-open', title: 'Write your questions down', body: 'Jot down what you want to ask at your next check-up so nothing slips your mind.' },
  { icon: 'shield', title: 'Plan your route', body: 'Know how you would get to the hospital in an emergency. LONI can book a ride for you.' },
];

const POSTPARTUM_TIPS: DailyTip[] = [
  { icon: 'droplet', title: 'Keep drinking water', body: 'Especially if you are breastfeeding, keep a bottle close to where you feed.' },
  { icon: 'moon', title: 'Sleep when baby sleeps', body: 'The dishes can wait. Rest is part of your recovery, not a luxury.' },
  { icon: 'heart', title: 'Ask for help', body: 'Let your partner, family or support circle take something off your plate today.' },
  { icon: 'activity', title: 'Ease back in', body: 'Gentle walks are enough for now. Check in with your nurse before anything harder.' },
  { icon: 'smile', title: 'Your feelings are valid', body: 'The baby blues are common. If low mood lingers, please talk to a nurse.' },
  { icon: 'coffee', title: 'Nourish yourself', body: 'Eat regular, balanced meals. Healing takes fuel, and so does feeding a newborn.' },
  { icon: 'phone', title: 'We are one call away', body: 'Worried about something? You can talk to a nurse by voice at any time.' },
];

const GENERAL_TIPS: DailyTip[] = [
  { icon: 'droplet', title: 'Water first', body: 'A glass of water when you wake up and one with each meal makes a real difference to energy and skin.' },
  { icon: 'moon', title: 'Protect your sleep', body: 'A regular bedtime and screens off 30 minutes earlier can steady your mood and your cycle.' },
  { icon: 'heart', title: 'Know your cycle', body: 'Noting when your period starts and how you feel helps you spot what is normal for you.' },
  { icon: 'activity', title: 'Move in a way you enjoy', body: 'Walking, dancing or stretching for 20 minutes counts. Little and often beats rarely and hard.' },
  { icon: 'smile', title: 'Check in with yourself', body: 'How are you really feeling today? Naming it is the first step. Loni is here to talk.' },
  { icon: 'coffee', title: 'Eat the rainbow', body: 'Colourful vegetables, beans and fruit through the week support hormones, energy and iron.' },
  { icon: 'shield', title: 'Look after your breasts and cervix', body: 'Check your breasts monthly and ask your clinician about screening that is right for your age.' },
  { icon: 'phone', title: 'Questions you were too shy to ask', body: 'Periods, sex, contraception, mood. Ask Loni anything, privately, any time.' },
];

/** One tip per calendar day, the same all day and different tomorrow. */
export function tipOfTheDay(kind: PregnancyProgress['kind'] | 'general' | undefined, date = new Date()): DailyTip {
  const tips = kind === 'postpartum' ? POSTPARTUM_TIPS : kind === 'pregnant' ? PREGNANCY_TIPS : GENERAL_TIPS;
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  return tips[dayNumber % tips.length];
}
