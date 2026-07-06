import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HelixaText } from '../../components/HelixaText';

export default function HistoryScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <HelixaText style={{ fontSize: 24 }} weight="bold">History</HelixaText>
      </View>
    </SafeAreaView>
  );
}
