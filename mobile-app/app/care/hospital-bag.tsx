import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { HelixaText } from '../../components/HelixaText';
import { CareScreen, Checkbox, Chip } from '../../components/care/CareParts';
import { useTheme } from '../../context/ThemeContext';
import { useHospitalBag, useToggleBagItem } from '../../hooks/useCare';

export default function HospitalBagScreen() {
  const { colors } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useHospitalBag();
  const toggle = useToggleBagItem();
  const [groupId, setGroupId] = useState<string | null>(null);

  const group = data?.groups.find((g) => g.id === groupId) ?? data?.groups[0];

  return (
    <CareScreen
      title="Hospital Bag"
      subtitle={data ? `Start packing — aim to have everything ready by week 36. ${data.done} of ${data.total} packed.` : undefined}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      onRefresh={refetch}
      refreshing={isRefetching}
    >
      {data && group && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            {data.groups.map((g) => {
              const done = g.items.filter((i) => i.checked).length;
              return <Chip key={g.id} label={`${g.title} ${done}/${g.items.length}`} selected={g.id === group.id} onPress={() => setGroupId(g.id)} />;
            })}
          </ScrollView>

          <View style={{ gap: 10 }}>
            {group.items.map((item) => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.checked }}
                onPress={() =>
                  toggle.mutate(
                    { key: item.key, checked: !item.checked },
                    { onError: (e: any) => Toast.show({ type: 'error', text1: 'Could not save', text2: e?.response?.data?.message || e?.message }) },
                  )
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card }}
              >
                <Checkbox checked={item.checked} />
                <HelixaText style={{ flex: 1, fontSize: 14, color: item.checked ? colors.textMuted : colors.text, textDecorationLine: item.checked ? 'line-through' : 'none' }}>
                  {item.title}
                </HelixaText>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </CareScreen>
  );
}
