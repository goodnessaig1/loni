import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Avatar } from '../../components/Avatar';
import { CustomSwitch } from 'components/CustomSwitch';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { useCallStore } from '../../store/callStore';
import { useCall } from '../../hooks/useCall';
import { useCallHistory } from '../../hooks/useCallHistory';
import { Reveal, RevealList } from '../../components/motion';
import { useRouter, useFocusEffect } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';


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

export default function NurseDashboardScreen() {
  const { user } = useAuth();

  // Initialize isOnline from user data
  const [isOnline, setIsOnline] = useState<boolean>((user as any)?.is_online ?? false);
  const [stats, setStats] = useState<{ total_calls: number; total_duration_formatted: string; today_calls?: number; rating_avg?: number | null; rating_count?: number }>({ total_calls: 0, total_duration_formatted: '0 mins' });
  const { data: recentActivities = [] } = useCallHistory(10);

  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        try {
          const statsRes = await apiClient.get('/calls/stats');
          setStats(statsRes.data);
        } catch (e) {
          console.error("Failed to fetch stats", e);
        }
      };
      fetchData();
    }, [user?.id])
  );

  const hour = new Date().getHours();
  let greeting = 'Evening';
  if (hour < 12) greeting = 'Morning';
  else if (hour < 18) greeting = 'Afternoon';

  const firstName = user?.name ? user.name.split(' ')[0] : 'Nurse';

  const handleToggleOnline = async (value: boolean) => {
    // Optimistically update UI
    setIsOnline(value);
    try {
      await apiClient.patch('/users/online-status', { is_online: value });
    } catch (err) {
      // Revert on failure
      console.error('Failed to update online status', err);
      setIsOnline(!value);
    }
  };

  const { status, callId, remoteParticipant, incomingRequests } = useCallStore();
  const { rejectCall } = useCall();
  const router = useRouter();

  const [showAllRequests, setShowAllRequests] = useState(false);
  const topRequests = incomingRequests.slice(0, 3);
  const hasIncomingRequests = incomingRequests.length > 0;

  const handleDecline = async (id: number) => {
    await rejectCall(id);
  };

  const handleView = (id: number) => {
    setShowAllRequests(false);
    router.push({ pathname: '/incoming-call', params: { callId: id } });
  };



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Header */}
        <Reveal index={0}>
          <View style={styles.headerRow}>
            <View style={styles.verifiedBadge}>
              <MaterialCommunityIcons name="check-decagram" size={16} color="#00C300" />
              <HelixaText style={styles.verifiedText} weight="bold">
                Verified Nurse
              </HelixaText>
            </View>
            <Avatar
              uri={user?.profilePicture || null}
              name={user?.name || 'Nurse'}
              style={styles.avatar}
            />
          </View>
        </Reveal>

        {/* Greeting */}
        <Reveal index={1}>
          <View style={styles.greetingContainer}>
            <CalText style={styles.greetingTime}>Good {greeting},</CalText>
            <View style={styles.greetingNameRow}>
              <HelixaText style={styles.greetingName}>{firstName}</HelixaText>
              <HelixaText style={{ fontSize: 24, marginLeft: 8 }}>
                {hour < 12 ? '🌤️' : hour < 18 ? '☀️' : '🌙'}
              </HelixaText>
            </View>
          </View>
        </Reveal>

        {/* Online Toggle */}
        <Reveal index={2}>
          <View style={styles.onlineCard}>
            <View style={styles.onlineTextContent}>
              <HelixaText style={styles.onlineTitle} weight="bold">
                You're {isOnline ? 'Online' : 'Offline'}
              </HelixaText>
              <HelixaText style={styles.onlineSubtitle}>
                {isOnline
                  ? "You will receive support requests while you're online."
                  : "You won't receive new requests."}
              </HelixaText>
            </View>
            <CustomSwitch
              value={isOnline}
              onValueChange={handleToggleOnline}
              activeColor="#D62D88"
            />
          </View>
        </Reveal>

        {/* Incoming Requests */}
        <Reveal index={3}>
          <View style={styles.sectionHeader}>
            <HelixaText style={styles.sectionTitle}>Incoming Requests</HelixaText>
            {hasIncomingRequests && (
              <TouchableOpacity onPress={() => setShowAllRequests(true)}>
                <HelixaText style={styles.viewAllText}>View all ❯</HelixaText>
              </TouchableOpacity>
            )}
          </View>

          {hasIncomingRequests ? (
            <View style={{ gap: 12 }}>
              {topRequests.map((req, i) => (
                <RevealList key={req.callId} index={i}>
                  <View style={styles.incomingCard}>
                    <View style={styles.incomingTop}>
                      <Avatar
                        uri={req.remote?.profile_picture || null}
                        name={req.remote?.name || 'A Mother'}
                        style={styles.incomingAvatar}
                      />
                      <View style={styles.incomingInfo}>
                        <View style={styles.incomingNameRow}>
                          <HelixaText style={styles.incomingName} weight="bold">
                            {req.remote?.name || 'A Mother'}
                          </HelixaText>
                          <HelixaText style={styles.incomingTime}>Just now</HelixaText>
                        </View>
                        {!!req.remote?.trimester && (
                          <View style={styles.trimesterRow}>
                            <TrimesterIcon />
                            <HelixaText style={styles.trimesterText}>
                              {req.remote.trimester}{req.remote.pregnancy_week ? ` · Week ${req.remote.pregnancy_week}` : ''}
                            </HelixaText>
                          </View>
                        )}
                        <View style={styles.plusMemberBadge}>
                          <View style={styles.plusDot} />
                          <HelixaText style={styles.plusMemberText}>Plus Member</HelixaText>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.callIconBtn} onPress={() => handleView(req.callId)}>
                        <Feather name="phone-call" size={18} color="#000" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.incomingActions}>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => handleDecline(req.callId)}>
                        <HelixaText style={styles.declineBtnText}>Decline</HelixaText>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.viewBtn} onPress={() => handleView(req.callId)}>
                        <Feather name="phone" size={16} color="#FFF" style={{ marginRight: 6 }} />
                        <HelixaText style={styles.viewBtnText}>View</HelixaText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </RevealList>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <HelixaText style={styles.emptyText}>No incoming requests right now.</HelixaText>
            </View>
          )}
        </Reveal>

        {/* Today at a glance */}
        <Reveal index={4}>
          <HelixaText style={[styles.sectionTitle, { marginTop: 32 }]}>Today at a glance</HelixaText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.glanceScroll}>
            <View style={styles.glanceCardLight}>
              <View style={styles.glanceIconBox}>
                <Feather name="phone-call" size={20} color="#000" />
              </View>
              <HelixaText style={styles.glanceValue} weight="bold">
                {stats.total_calls}
              </HelixaText>
              <HelixaText style={styles.glanceLabel}>Total Calls</HelixaText>
              <HelixaText style={styles.glanceSub}>All time</HelixaText>
            </View>
            <View style={styles.glanceCardLight}>
              <View style={styles.glanceIconBox}>
                <Feather name="clock" size={20} color="#000" />
              </View>
              <HelixaText style={styles.glanceValue} weight="bold">
                {stats.total_duration_formatted}
              </HelixaText>
              <HelixaText style={styles.glanceLabel}>Total Call Time</HelixaText>
              <HelixaText style={styles.glanceSub}>All time</HelixaText>
            </View>
            <View style={styles.glanceCardDark}>
              <View style={[styles.glanceIconBox, { backgroundColor: '#FFF' }]}>
                <Feather name="star" size={16} color="#F59E0B" fill="#F59E0B" />
              </View>
              <HelixaText style={[styles.glanceValue, { color: '#FFF' }]} weight="bold">
                {stats.rating_avg != null ? stats.rating_avg.toFixed(1) : '—'}
              </HelixaText>
              <HelixaText style={[styles.glanceLabel, { color: '#D1D5DB' }]}>Rating</HelixaText>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <Feather name="star" size={12} color="#F59E0B" fill="#F59E0B" />
                <HelixaText style={{ color: '#FFF', fontSize: 12, marginLeft: 4 }}>
                  {stats.rating_count ? `${stats.rating_count} rating${stats.rating_count === 1 ? '' : 's'}` : 'No ratings yet'}
                </HelixaText>
              </View>
            </View>
            <View style={styles.glanceCardLight}>
              <View style={styles.glanceIconBox}>
                <Feather name="check-circle" size={16} color="#000" />
              </View>
              <HelixaText style={styles.glanceValue} weight="bold">
                {stats.today_calls ?? 0}
              </HelixaText>
              <HelixaText style={styles.glanceLabel}>Calls Today</HelixaText>
              <HelixaText style={styles.glanceSub}>Since midnight</HelixaText>
            </View>
          </ScrollView>
        </Reveal>

        {/* Recent Activity */}
        <Reveal index={5}>
          <View style={[styles.sectionHeader, { marginTop: 32 }]}>
            <HelixaText style={styles.sectionTitle}>Recent Activity</HelixaText>
            {recentActivities.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/history' as any)}>
                <HelixaText style={styles.viewAllText}>View all ❯</HelixaText>
              </TouchableOpacity>
            )}
          </View>

          {recentActivities.length > 0 ? (
            <View style={styles.recentContainer}>
              {recentActivities.map((activity, index) => {
                return (
                  <RevealList key={activity.id} index={index}>
                      <View style={styles.recentItem}>
                        <Avatar 
                          uri={activity.img}
                          name={activity.name}
                          style={styles.recentAvatar}
                        />
                        <View style={styles.recentInfo}>
                          <HelixaText style={styles.recentName} weight="bold">
                            {activity.name}
                          </HelixaText>
                          {activity.trimester && activity.trimester !== 'Unknown' && (
                            <View style={styles.trimesterRow}>
                              <TrimesterIcon />
                              <HelixaText style={styles.trimesterText}>{activity.trimester}</HelixaText>
                            </View>
                          )}
                        </View>
                        <View style={styles.recentRight}>
                          <HelixaText style={styles.recentTimeTop}>
                            {activity.durationFormatted}
                          </HelixaText>
                          <HelixaText style={styles.recentTimeBottom}>
                            {activity.relativeTime}
                          </HelixaText>
                        </View>
                        <TouchableOpacity style={styles.recentArrow} onPress={() => router.push({ pathname: '/(tabs)/history', params: { callId: String(activity.id) } } as any)}>
                          <Feather name="chevron-right" size={16} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                      {index < recentActivities.length - 1 && <View style={styles.divider} />}
                  </RevealList>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyCard, { marginBottom: 40 }]}>
              <HelixaText style={styles.emptyText}>No recent activity.</HelixaText>
            </View>
          )}
        </Reveal>
      </ScrollView>

      {/* View All Incoming Requests Modal */}
      <Modal visible={showAllRequests} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAllRequests(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAllRequests(false)} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#000" />
            </TouchableOpacity>
            <HelixaText style={styles.modalTitle} weight="bold">All Requests ({incomingRequests.length})</HelixaText>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {incomingRequests.map((req) => (
              <View key={req.callId} style={styles.incomingCard}>
                <View style={styles.incomingTop}>
                  <Avatar
                    uri={req.remote?.profile_picture || null}
                    name={req.remote?.name || 'A Mother'}
                    style={styles.incomingAvatar}
                  />
                  <View style={styles.incomingInfo}>
                    <View style={styles.incomingNameRow}>
                      <HelixaText style={styles.incomingName} weight="bold">{req.remote?.name || 'A Mother'}</HelixaText>
                      <HelixaText style={styles.incomingTime}>Just now</HelixaText>
                    </View>
                    {!!req.remote?.trimester && (
                      <View style={styles.trimesterRow}>
                        <TrimesterIcon />
                        <HelixaText style={styles.trimesterText}>
                          {req.remote.trimester}{req.remote.pregnancy_week ? ` · Week ${req.remote.pregnancy_week}` : ''}
                        </HelixaText>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.incomingActions}>
                  <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(req.callId)}>
                    <HelixaText style={styles.declineBtnText}>Decline</HelixaText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => handleView(req.callId)}>
                    <Feather name="phone" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <HelixaText style={styles.viewBtnText}>View</HelixaText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {incomingRequests.length === 0 && (
              <View style={styles.emptyCard}>
                <HelixaText style={styles.emptyText}>No pending requests.</HelixaText>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingTop: 16,
    paddingBottom: 140, // space for tab bar
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F9E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  verifiedText: {
    color: '#00C300',
    fontSize: 12,
    marginLeft: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  greetingContainer: {
    marginBottom: 24,
  },
  greetingTime: {
    fontSize: 32,
    color: '#D62D88',
    marginBottom: 4,
  },
  greetingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingName: {
    fontSize: 32,
    color: '#000000',
  },
  onlineCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  onlineTextContent: {
    flex: 1,
    paddingRight: 16,
  },
  onlineTitle: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  onlineSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  viewAllText: {
    fontSize: 14,
    color: '#D62D88',
    fontWeight: '500',
  },
  incomingCard: {
    backgroundColor: '#FFEBF3',
    borderRadius: 16,
    padding: 16,
  },
  incomingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  incomingAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  incomingInfo: {
    flex: 1,
  },
  incomingNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  incomingName: {
    fontSize: 16,
    color: '#000000',
  },
  incomingTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  trimesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  trimesterText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
  },
  plusMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD6E8',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFB8D6',
  },
  plusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E74C3C',
    marginRight: 4,
  },
  plusMemberText: {
    fontSize: 10,
    color: '#E74C3C',
    fontWeight: '600',
  },
  callIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  declineBtnText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  viewBtn: {
    flex: 1,
    backgroundColor: '#D62D88',
    paddingVertical: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  glanceScroll: {
    gap: 16,
    paddingRight: 20,
    marginTop: 16,
  },
  glanceCardLight: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    width: 140,
  },
  glanceCardDark: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 20,
    width: 140,
  },
  glanceIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  glanceValue: {
    fontSize: 24,
    color: '#000000',
    marginBottom: 4,
  },
  glanceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  glanceSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 'auto',
  },
  recentContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  recentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  recentRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  recentTimeTop: {
    fontSize: 13,
    color: '#6B7280',
  },
  recentTimeBottom: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  recentArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 60,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  tabBar: {
    backgroundColor: '#000000',
    height: 87,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
    color: '#6B6B6B',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    color: '#000',
  },
  closeBtn: {
    padding: 4,
  },
});
