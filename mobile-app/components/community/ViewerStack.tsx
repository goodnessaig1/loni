import React from 'react';
import { View } from 'react-native';
import { Avatar } from '../Avatar';
import { HelixaText } from '../HelixaText';
import type { CommunityAuthor } from '../../api/community';
import { formatCount } from '../../lib/formatCount';
import { useTheme } from '../../context/ThemeContext';

/** Up to three overlapping viewer avatars, a pink "17k" pill and the "Viewers" label. */
export function ViewerStack({ viewers, count }: { viewers: CommunityAuthor[]; count: number }) {
  const { colors, isDark } = useTheme();
  if (count <= 0) return null;
  const shown = viewers.slice(0, 3);
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center' }}
      accessible
      accessibilityLabel={`${count} ${count === 1 ? 'viewer' : 'viewers'}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {shown.map((v, i) => (
          <Avatar
            key={`${v.id}-${i}`}
            uri={v.profile_picture}
            name={v.name}
            style={{ width: 30, height: 30, borderRadius: 15, marginLeft: i === 0 ? 0 : -9, borderWidth: 2, borderColor: colors.bg }}
          />
        ))}
        <View
          style={{
            height: 30, minWidth: 30, paddingHorizontal: 7, borderRadius: 15, marginLeft: shown.length ? -9 : 0,
            backgroundColor: isDark ? '#3A1B2E' : '#F6DCEA', borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center',
          }}>
          <HelixaText weight="bold" style={{ fontSize: 11, color: '#D62D88' }}>{formatCount(count, true)}</HelixaText>
        </View>
      </View>
      <HelixaText style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 10 }}>Viewers</HelixaText>
    </View>
  );
}
