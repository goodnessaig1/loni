import type { User } from '../context/AuthContext';

export interface ChatTopic {
  id: number;
  /** The label on the card and the chip. Also what Loni is told she wants help with. */
  title: string;
  image: 'pregnancy' | 'recovery' | 'emotional' | 'emergency';
}

const EMOTIONAL: ChatTopic = { id: 3, title: 'Emotional Support ?', image: 'emotional' };
const EMERGENCY: ChatTopic = { id: 4, title: 'Emergency Guidance ?', image: 'emergency' };

/** The four "what are you looking for today?" topics, matched to where she is. Loni is for every woman, not only mothers. */
export function chatTopicsFor(status: User['status'] | undefined): ChatTopic[] {
  switch (status) {
    case 'general':
      return [{ id: 1, title: 'Periods & Cycle ?', image: 'pregnancy' }, { id: 2, title: 'Contraception & Sexual Health ?', image: 'recovery' }, EMOTIONAL, EMERGENCY];
    case 'ttc':
      return [{ id: 1, title: 'Fertility & Conceiving ?', image: 'pregnancy' }, { id: 2, title: 'Periods & Cycle ?', image: 'recovery' }, EMOTIONAL, EMERGENCY];
    case 'newMom':
      return [{ id: 1, title: 'Baby & Feeding ?', image: 'pregnancy' }, { id: 2, title: 'Recovery Support ?', image: 'recovery' }, EMOTIONAL, EMERGENCY];
    default:
      return [{ id: 1, title: 'Pregnancy Support ?', image: 'pregnancy' }, { id: 2, title: 'Recovery Support ?', image: 'recovery' }, EMOTIONAL, EMERGENCY];
  }
}
