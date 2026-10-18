import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { PillsIcon, WalkIcon, WaterIcon, RelaxationIcon } from '../../components/RecoveryIcons';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { Reveal, RevealList } from '../../components/motion';

const INITIAL_TASKS = [
  {
    id: '1',
    title: 'Take prenatal vitamin',
    subtitle: 'With breakfast or lunch',
    icon: <PillsIcon size={24} />,
    bgColor: '#FDE4D0',
    completed: true,
  },
  {
    id: '2',
    title: '15-minute walk',
    subtitle: 'Light exercise, listen to your body',
    icon: <WalkIcon size={24} />,
    bgColor: '#E6F0C9',
    completed: true,
  },
  {
    id: '3',
    title: 'Drink 8 glasses of water',
    subtitle: 'Stay hydrated throughout the day',
    icon: <WaterIcon size={24} />,
    bgColor: '#FCE7F3',
    completed: false,
  },
  {
    id: '4',
    title: 'Evening relaxation',
    subtitle: '10 minutes of breathing exercises or meditation',
    icon: <RelaxationIcon size={24} />,
    bgColor: '#FDE4D0',
    completed: false,
  },
];

export default function RecoveryPlanScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercent = (completedCount / tasks.length) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Reveal index={0}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      </Reveal>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Reveal index={1}>
        <CalText style={styles.pageTitle}>Recovery Plan</CalText>
        <HelixaText style={styles.pageSubtitle}>Your personalized daily guidance</HelixaText>
        </Reveal>

        {/* Progress Card */}
        <Reveal index={2}>
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <HelixaText style={styles.progressTitle}>Progress</HelixaText>
            <HelixaText style={styles.progressText}>{completedCount} of {tasks.length} completed</HelixaText>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
        </Reveal>

        <Reveal index={3}>
        <HelixaText weight="bold" style={styles.sectionTitle}>Today's Tasks</HelixaText>
        </Reveal>

        {/* Task List */}
        <View style={styles.tasksContainer}>
          {tasks.map((task, i) => (
            <RevealList key={task.id} index={4 + i}>
            <TouchableOpacity 
              style={styles.taskItem}
              activeOpacity={0.7}
              onPress={() => toggleTask(task.id)}
            >
              <View style={styles.checkContainer}>
                {task.completed ? (
                  <View style={styles.checkedCircle}>
                    <Feather name="check" size={14} color="#FFF" />
                  </View>
                ) : (
                  <View style={styles.uncheckedCircle} />
                )}
              </View>
              
              <View style={styles.taskContentBox}>
                <View style={[styles.iconBox, { backgroundColor: task.bgColor }]}>
                  {task.icon}
                </View>
                <View style={styles.taskTextContainer}>
                  <HelixaText weight="bold" style={styles.taskTitle}>{task.title}</HelixaText>
                  <HelixaText style={styles.taskSubtitle}>{task.subtitle}</HelixaText>
                </View>
              </View>
            </TouchableOpacity>
            </RevealList>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    color: '#D62D88',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: c.textSecondary,
    marginBottom: 24,
  },
  progressCard: {
    backgroundColor: c.nav,
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    color: c.text,
    marginBottom: 16,
  },
  tasksContainer: {
    gap: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkContainer: {
    marginRight: 16,
  },
  checkedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D62D88',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  taskContentBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  taskTextContainer: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    color: c.text,
    marginBottom: 4,
  },
  taskSubtitle: {
    fontSize: 14,
    color: c.textSecondary,
  },
});
