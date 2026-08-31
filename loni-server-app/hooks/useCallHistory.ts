import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from './useAuth';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export type CallStatus = 'completed' | 'missed';

export type CallRecord = {
  id: string;
  name: string;
  trimester: string;
  durationFormatted: string; // e.g. "1 min", "20 secs"
  timeLabel: string; // "Today" | "Yesterday"
  relativeTime: string; // "2 mins ago"
  date: string;    // e.g. "Friday, June 5, 2026"
  time: string;    // e.g. "02:30 PM"
  duration: string; // e.g. "12:34" or "20s"
  status: CallStatus;
  img: string;
};

export const useCallHistory = (limit: number = 50) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['callHistory', user?.id, limit],
    queryFn: async () => {
      const res = await apiClient.get(`/calls/history?limit=${limit}`);
      const formatted: CallRecord[] = res.data.map((call: any): CallRecord => {
        const isCaller = call.caller_id === user?.id;
        const otherUser = isCaller ? call.receiver : call.caller;

        const dateObj = new Date(call.created_at);
        let timeLabel = '';
        if (isToday(dateObj)) timeLabel = 'Today';
        else if (isYesterday(dateObj)) timeLabel = 'Yesterday';
        else timeLabel = format(dateObj, 'MMM d, yyyy');

        const isCompleted = call.status === 'ended' || call.status === 'ENDED' || call.status === 'ACCEPTED' || call.status === 'CONNECTED';
        const statusLabel = isCompleted ? 'completed' : 'missed';

        const durationSeconds = call.duration_seconds || 0;
        
        let durationStr = '';
        let durationFormatted = '';
        if (durationSeconds < 60) {
            durationStr = `00:${String(durationSeconds).padStart(2, '0')}`;
            durationFormatted = `${durationSeconds} secs`;
        } else {
            const m = Math.floor(durationSeconds / 60);
            const s = durationSeconds % 60;
            durationStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            durationFormatted = `${m} min${m !== 1 ? 's' : ''}`;
        }
        
        let relativeTime = 'Just now';
        try { relativeTime = formatDistanceToNow(dateObj, { addSuffix: true }); } catch {}
        
        return {
          id: String(call.id),
          name: otherUser?.name || (isCaller ? 'A Nurse' : 'A Mother'),
          trimester: otherUser?.trimester || 'Unknown',
          durationFormatted,
          timeLabel,
          relativeTime,
          date: format(dateObj, 'EEEE, MMMM d, yyyy'),
          time: format(dateObj, 'hh:mm a'),
          duration: durationStr,
          status: statusLabel,
          img: otherUser?.profile_picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        };
      });
      return formatted;
    },
    enabled: !!user?.id,
  });
};
