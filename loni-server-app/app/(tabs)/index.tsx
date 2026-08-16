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
import { useRouter, useFocusEffect } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';

// Custom SVGs from user request
const HomeIcon = ({ color }: { color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 19H9V14C9 13.7167 9.096 13.4793 9.288 13.288C9.48 13.0967 9.71733 13.0007 10 13H14C14.2833 13 14.521 13.096 14.713 13.288C14.905 13.48 15.0007 13.7173 15 14V19H18V10L12 5.5L6 10V19ZM4 19V10C4 9.68333 4.071 9.38333 4.213 9.1C4.355 8.81667 4.55067 8.58333 4.8 8.4L10.8 3.9C11.15 3.63333 11.55 3.5 12 3.5C12.45 3.5 12.85 3.63333 13.2 3.9L19.2 8.4C19.45 8.58333 19.646 8.81667 19.788 9.1C19.93 9.38333 20.0007 9.68333 20 10V19C20 19.55 19.804 20.021 19.412 20.413C19.02 20.805 18.5493 21.0007 18 21H14C13.7167 21 13.4793 20.904 13.288 20.712C13.0967 20.52 13.0007 20.2827 13 20V15H11V20C11 20.2833 10.904 20.521 10.712 20.713C10.52 20.905 10.2827 21.0007 10 21H6C5.45 21 4.97933 20.8043 4.588 20.413C4.19667 20.0217 4.00067 19.5507 4 19Z"
      fill={color}
    />
  </Svg>
);

const HistoryIcon = ({ color }: { color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 20C14.1217 20 16.1566 19.1571 17.6569 17.6569C19.1571 16.1566 20 14.1217 20 12C20 9.87827 19.1571 7.84344 17.6569 6.34315C16.1566 4.84285 14.1217 4 12 4C9.87827 4 7.84344 4.84285 6.34315 6.34315C4.84285 7.84344 4 9.87827 4 12C4 14.1217 4.84285 16.1566 6.34315 17.6569C7.84344 19.1571 9.87827 20 12 20ZM12 2C13.3132 2 14.6136 2.25866 15.8268 2.7612C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893C19.9997 5.85752 20.7362 6.95991 21.2388 8.17317C21.7413 9.38642 22 10.6868 22 12C22 14.6522 20.9464 17.1957 19.0711 19.0711C17.1957 20.9464 14.6522 22 12 22C6.47 22 2 17.5 2 12C2 9.34784 3.05357 6.8043 4.92893 4.92893C6.8043 3.05357 9.34784 2 12 2ZM12.5 7V12.25L17 14.92L16.25 16.15L11 13V7H12.5Z"
      fill={color}
    />
  </Svg>
);

const ProfileIcon = ({ color }: { color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16 9C16 10.0609 15.5786 11.0783 14.8284 11.8284C14.0783 12.5786 13.0609 13 12 13C10.9391 13 9.92172 12.5786 9.17157 11.8284C8.42143 11.0783 8 10.0609 8 9C8 7.93913 8.42143 6.92172 9.17157 6.17157C9.92172 5.42143 10.9391 5 12 5C13.0609 5 14.0783 5.42143 14.8284 6.17157C15.5786 6.92172 16 7.93913 16 9ZM14 9C14 9.53043 13.7893 10.0391 13.4142 10.4142C13.0391 10.7893 12.5304 11 12 11C11.4696 11 10.9609 10.7893 10.5858 10.4142C10.2107 10.0391 10 9.53043 10 9C10 8.46957 10.2107 7.96086 10.5858 7.58579C10.9609 7.21071 11.4696 7 12 7C12.5304 7 13.0391 7.21071 13.4142 7.58579C13.7893 7.96086 14 8.46957 14 9Z"
      fill={color}
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1C5.925 1 1 5.925 1 12C1 18.075 5.925 23 12 23C18.075 23 23 18.075 23 12C23 5.925 18.075 1 12 1ZM3 12C3 14.09 3.713 16.014 4.908 17.542C5.74744 16.4401 6.83015 15.5471 8.07164 14.9327C9.31312 14.3183 10.6798 13.9991 12.065 14C13.4324 13.9984 14.7821 14.3091 16.0111 14.9084C17.2402 15.5077 18.3162 16.3797 19.157 17.458C20.0234 16.3216 20.6068 14.9952 20.8589 13.5886C21.111 12.182 21.0244 10.7355 20.6065 9.36898C20.1886 8.00243 19.4512 6.75505 18.4555 5.73004C17.4598 4.70503 16.2343 3.93186 14.8804 3.47451C13.5265 3.01716 12.0832 2.88877 10.6699 3.09997C9.25652 3.31117 7.91379 3.85589 6.75277 4.68905C5.59175 5.52222 4.64581 6.61987 3.99323 7.8912C3.34065 9.16252 3.00018 10.571 3 12ZM12 21C9.93391 21.0033 7.93014 20.2926 6.328 18.988C6.97281 18.0646 7.83119 17.3107 8.83008 16.7905C9.82896 16.2702 10.9388 15.5999 12.065 16C13.1772 15.999 14.2735 16.2635 15.263 16.7713C16.2524 17.2792 17.1064 18.0158 17.754 18.92C16.1395 20.267 14.1026 21.0033 12 21Z"
      fill={color}
    />
  </Svg>
);

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
  const [stats, setStats] = useState({ total_calls: 0, total_duration_formatted: '0 mins' });
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

        {/* Greeting */}
        <View style={styles.greetingContainer}>
          <CalText style={styles.greetingTime}>Good {greeting},</CalText>
          <View style={styles.greetingNameRow}>
            <HelixaText style={styles.greetingName}>{firstName}</HelixaText>
            <HelixaText style={{ fontSize: 24, marginLeft: 8 }}>
              {hour < 12 ? '🌤️' : hour < 18 ? '☀️' : '🌙'}
            </HelixaText>
          </View>
        </View>

        {/* Online Toggle */}
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

        {/* Incoming Requests */}
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
            {topRequests.map((req) => (
              <View key={req.callId} style={styles.incomingCard}>
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
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <HelixaText style={styles.emptyText}>No incoming requests right now.</HelixaText>
          </View>
        )}

        {/* Today at a glance */}
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
              4.9
            </HelixaText>
            <HelixaText style={[styles.glanceLabel, { color: '#D1D5DB' }]}>Rating</HelixaText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Feather name="star" size={12} color="#F59E0B" fill="#F59E0B" />
              <HelixaText style={{ color: '#FFF', fontSize: 12, marginLeft: 4 }}>
                Great job
              </HelixaText>
            </View>
          </View>
          <View style={styles.glanceCardLight}>
            <View style={styles.glanceIconBox}>
              <Feather name="check-circle" size={16} color="#000" />
            </View>
            <HelixaText style={styles.glanceValue} weight="bold">
              284
            </HelixaText>
            <HelixaText style={styles.glanceLabel}>Total Calls</HelixaText>
            <HelixaText style={styles.glanceSub}>All time</HelixaText>
          </View>
        </ScrollView>

        {/* Recent Activity */}
        <View style={[styles.sectionHeader, { marginTop: 32 }]}>
          <HelixaText style={styles.sectionTitle}>Recent Activity</HelixaText>
          {recentActivities.length > 0 && (
            <TouchableOpacity>
              <HelixaText style={styles.viewAllText}>View all ❯</HelixaText>
            </TouchableOpacity>
          )}
        </View>

        {recentActivities.length > 0 ? (
          <View style={styles.recentContainer}>
            {recentActivities.map((activity, index) => {
              return (
                <View key={activity.id}>
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
                    <TouchableOpacity style={styles.recentArrow}>
                      <Feather name="chevron-right" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  {index < recentActivities.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, { marginBottom: 40 }]}>
            <HelixaText style={styles.emptyText}>No recent activity.</HelixaText>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Tab Bar */}
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem}>
            <HomeIcon color="#FFFFFF" />
            <HelixaText style={[styles.tabText, { color: '#FFFFFF', fontWeight: 'bold' }]}>
              Home
            </HelixaText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <HistoryIcon color="#6B6B6B" />
            <HelixaText style={styles.tabText}>History</HelixaText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <ProfileIcon color="#6B6B6B" />
            <HelixaText style={styles.tabText}>Profile</HelixaText>
          </TouchableOpacity>
        </View>
      </View>

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
