import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

// Trimester icon from user request
const TrimesterIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <Path
      d="M12.375 1.5V4.31963C15.117 5.89237 16.3552 7.98512 16.0897 10.5979C15.8242 13.2106 14.586 15.178 12.375 16.5M5.1645 1.5C4.36275 1.63875 3.78575 2.1085 3.4335 2.90925C2.90475 4.11 1.875 8.2365 1.875 8.89725C1.875 9.558 3.213 11.3381 6.3945 14.0385C7.86863 15.2895 8.74013 15.2257 9.21188 14.3865C9.68363 13.5472 9.05925 13.0087 8.26875 12.3889C6.82012 11.253 4.91325 9.45563 4.91325 8.66663C4.91325 8.14063 5.407 6.53762 6.3945 3.85762"
      stroke="#6B6B6B"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M3.07617 10.8525C3.27478 12.7526 3.62591 14.6337 4.12617 16.4775M12.3758 7.479C12.9558 7.8645 13.3308 8.366 13.5008 8.9835C13.6708 9.6015 13.7203 10.1648 13.6493 10.6733"
      stroke="#6B6B6B"
      strokeLinecap="round"
    />
  </Svg>
);

type CallStatus = 'completed' | 'missed';

type CallRecord = {
  id: string;
  name: string;
  trimester: string;
  durationMins: number;
  timeLabel: string; // "Today" | "Yesterday"
  date: string;    // e.g. "Friday, June 5, 2026"
  time: string;    // e.g. "02:30 PM"
  duration: string; // e.g. "12:34"
  status: CallStatus;
  img: string;
};

const MOCK_CALLS: CallRecord[] = [
  {
    id: '1',
    name: 'Sarah A.',
    trimester: '2nd Trimester',
    durationMins: 8,
    timeLabel: 'Today',
    date: 'Friday, June 5, 2026',
    time: '02:30 PM',
    duration: '08:14',
    status: 'completed',
    img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: '2',
    name: 'Mary O.',
    trimester: '1st Trimester',
    durationMins: 12,
    timeLabel: 'Yesterday',
    date: 'Thursday, June 4, 2026',
    time: '10:15 AM',
    duration: '12:42',
    status: 'completed',
    img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: '3',
    name: 'Sarah A.',
    trimester: '2nd Trimester',
    durationMins: 8,
    timeLabel: 'Today',
    date: 'Friday, June 5, 2026',
    time: '11:00 AM',
    duration: '00:00',
    status: 'missed',
    img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: '4',
    name: 'Grace A.',
    trimester: '3rd Trimester',
    durationMins: 6,
    timeLabel: 'Yesterday',
    date: 'Thursday, June 4, 2026',
    time: '04:45 PM',
    duration: '06:22',
    status: 'completed',
    img: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=150&q=80',
  },
];

export default function HistoryScreen() {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {selectedCall ? (
        /* ---- Call Details View ---- */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedCall(null)}>
            <Feather name="chevron-left" size={26} color="#000" />
          </TouchableOpacity>

          <CalText style={styles.detailHeading}>Call Details</CalText>

          {/* Status banner */}
          {selectedCall.status === 'completed' ? (
            <View style={styles.completedBanner}>
              <View style={styles.completedIconBox}>
                <Feather name="check" size={18} color="#FFFFFF" />
              </View>
              <View>
                <HelixaText style={styles.completedTitle} weight="bold">
                  Call Completed
                </HelixaText>
                <HelixaText style={styles.completedSubtitle}>Support session ended</HelixaText>
              </View>
            </View>
          ) : (
            <View style={styles.missedBanner}>
              <View style={styles.missedIconBox}>
                <Feather name="phone-missed" size={18} color="#FFFFFF" />
              </View>
              <View>
                <HelixaText style={styles.missedBannerTitle} weight="bold">
                  Missed Call
                </HelixaText>
                <HelixaText style={styles.missedBannerSubtitle}>You missed this support request</HelixaText>
              </View>
            </View>
          )}

          {/* Caller info + call meta card */}
          <View style={styles.detailCard}>
            <HelixaText style={styles.detailLabel}>Caller</HelixaText>
            <View style={styles.callerRow}>
              <Image source={{ uri: selectedCall.img }} style={styles.detailAvatar} />
              <View>
                <HelixaText style={styles.detailCallerName} weight="bold">
                  {selectedCall.name}
                </HelixaText>
                <View style={styles.trimesterRow}>
                  <TrimesterIcon />
                  <HelixaText style={styles.trimesterText}>{selectedCall.trimester}</HelixaText>
                </View>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <HelixaText style={styles.detailRowLabel}>Date</HelixaText>
              <HelixaText style={styles.detailRowValue} weight="bold">{selectedCall.date}</HelixaText>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <HelixaText style={styles.detailRowLabel}>Time</HelixaText>
              <HelixaText style={styles.detailRowValue} weight="bold">{selectedCall.time}</HelixaText>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <HelixaText style={styles.detailRowLabel}>Duration</HelixaText>
              <HelixaText style={styles.detailRowValue} weight="bold">{selectedCall.duration}</HelixaText>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* ---- Call History List ---- */
        <ScrollView contentContainerStyle={styles.scrollContent}>
        <CalText style={styles.heading}>Call History</CalText>
        <HelixaText style={styles.callCount}>{MOCK_CALLS.length} calls</HelixaText>

        <View style={styles.listCard}>
          {MOCK_CALLS.map((call, index) => (
            <View key={call.id}>
              <TouchableOpacity
                style={styles.callRow}
                activeOpacity={0.7}
                onPress={() => setSelectedCall(call)}
              >
                <Image source={{ uri: call.img }} style={styles.avatar} />

                <View style={styles.callInfo}>
                  <View style={styles.nameRow}>
                    <HelixaText style={styles.callerName} weight="bold">
                      {call.name}
                    </HelixaText>
                    {call.status === 'missed' && (
                      <View style={styles.missedBadge}>
                        <HelixaText style={styles.missedText}>Missed</HelixaText>
                      </View>
                    )}
                  </View>
                  <View style={styles.trimesterRow}>
                    <TrimesterIcon />
                    <HelixaText style={styles.trimesterText}>{call.trimester}</HelixaText>
                  </View>
                </View>

                <View style={styles.callMeta}>
                  <HelixaText style={styles.metaDuration}>{call.durationMins} mins</HelixaText>
                  <HelixaText style={styles.metaTime}>{call.timeLabel}</HelixaText>
                </View>

                <View style={styles.chevronBox}>
                  <Feather name="chevron-right" size={18} color="#6B7280" />
                </View>
              </TouchableOpacity>

              {/* Divider between rows, not after last */}
              {index < MOCK_CALLS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 140,
  },
  heading: {
    fontSize: 28,
    color: '#111827',
    marginBottom: 6,
  },
  callCount: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },

  // List card
  listCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    overflow: 'hidden',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  callInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  callerName: {
    fontSize: 15,
    color: '#111827',
  },
  missedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  missedText: {
    fontSize: 11,
    color: '#EF4444',
  },
  trimesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  trimesterText: {
    fontSize: 12,
    color: '#6B7280',
  },
  callMeta: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  metaDuration: {
    fontSize: 13,
    color: '#111827',
  },
  metaTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  chevronBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },

  // Call Details (inline view)
  backBtn: {
    marginBottom: 16,
  },
  detailHeading: {
    fontSize: 28,
    color: '#111827',
    marginBottom: 24,
  },

  // Status banners
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5FFF4',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  completedIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#15B300',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTitle: {
    fontSize: 15,
    color: '#15B300',
  },
  completedSubtitle: {
    fontSize: 12,
    color: '#15B300',
    opacity: 0.7,
    marginTop: 2,
  },

  missedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  missedIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missedBannerTitle: {
    fontSize: 15,
    color: '#DC2626',
  },
  missedBannerSubtitle: {
    fontSize: 12,
    color: '#F87171',
    marginTop: 2,
  },

  // Detail card
  detailCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  callerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  detailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  detailCallerName: {
    fontSize: 15,
    color: '#111827',
    marginBottom: 4,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailRowLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  detailRowValue: {
    fontSize: 14,
    color: '#111827',
  },
});
