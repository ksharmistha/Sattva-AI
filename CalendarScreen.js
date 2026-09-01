import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Ionicons } from '@expo/vector-icons';
import { addDays, getDaysInRange, toMonthKey, todayKey } from './lib/date';

const ACCENT_COLOR = '#9DC08B';  // Mint green

// Mood configurations
const MOOD_CONFIG = {
  Happy: { emoji: '😊', color: '#FFE17B', label: 'Happy' },
  Calm: { emoji: '😌', color: '#9DC08B', label: 'Calm' },
  Neutral: { emoji: '😐', color: '#8E9A9E', label: 'Neutral' },
  Sad: { emoji: '😔', color: '#83A2E8', label: 'Sad' },
  Stressed: { emoji: '😫', color: '#E88383', label: 'Stressed' }
};

// Cycle Tracker styling constants
const COLOR_PERIOD = '#E88383'; // Rose/Red for logged period
const COLOR_PREDICTED_PERIOD = 'rgba(232, 131, 131, 0.4)'; // Pink for predicted period
const COLOR_FERTILE = 'rgba(157, 192, 139, 0.3)'; // Light green/teal for fertile window
const COLOR_OVULATION = '#55ad8f'; // Darker teal for ovulation day


export default function CalendarScreen() {
  const [activeTab, setActiveTab] = useState('mood'); // 'mood' or 'cycle'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(toMonthKey());

  // Mood data states
  const [moodLogs, setMoodLogs] = useState({});
  const [moodCounts, setMoodCounts] = useState({ Happy: 0, Calm: 0, Neutral: 0, Sad: 0, Stressed: 0 });

  // Cycle data states
  const [cycleLogs, setCycleLogs] = useState({}); // dateStr -> { isPeriodStart, flow, symptoms: [] }
  const [cycleSettings, setCycleSettings] = useState({ cycleLength: 28, periodLength: 5 });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempCycleLength, setTempCycleLength] = useState('28');
  const [tempPeriodLength, setTempPeriodLength] = useState('5');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const refreshRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    loadAllData();
  }, [currentMonth]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([
      fetchMoodData(),
      fetchCycleData()
    ]);
    setLoading(false);
  };

  const spin = refreshRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRefresh = () => {
    Animated.timing(refreshRotation, {
      toValue: 1,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      refreshRotation.setValue(0);
      loadAllData();
    });
  };

  // 1. Fetch Mood Data
  const fetchMoodData = async () => {
    if (!auth?.currentUser) return;
    try {
      const q = query(
        collection(db, 'moods'),
        where('userId', '==', auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const logs = {};
      const newCounts = { Happy: 0, Calm: 0, Neutral: 0, Sad: 0, Stressed: 0 };

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date && data.mood) {
          logs[data.date] = data.mood;
          if (data.date.startsWith(currentMonth)) {
            newCounts[data.mood] = (newCounts[data.mood] || 0) + 1;
          }
        }
      });
      setMoodLogs(logs);
      setMoodCounts(newCounts);
    } catch (err) {
      console.error('Error fetching moods:', err);
      setError('Failed to load mood logs.');
    }
  };

  // 2. Fetch Cycle Data
  const fetchCycleData = async () => {
    if (!auth?.currentUser) return;
    try {
      // Fetch cycle settings
      const settingsDocRef = doc(db, 'cycle_settings', auth.currentUser.uid);
      const settingsSnap = await getDoc(settingsDocRef);
      let activeSettings = { cycleLength: 28, periodLength: 5 };
      if (settingsSnap.exists()) {
        activeSettings = settingsSnap.data();
        setCycleSettings(activeSettings);
        setTempCycleLength(String(activeSettings.cycleLength));
        setTempPeriodLength(String(activeSettings.periodLength));
      }

      // Fetch logged period days
      const q = query(
        collection(db, 'cycle_logs'),
        where('userId', '==', auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const logs = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date) {
          logs[data.date] = {
            isPeriodStart: data.isPeriodStart || false,
            flow: data.flow || 'None',
            symptoms: data.symptoms || []
          };
        }
      });
      setCycleLogs(logs);
    } catch (err) {
      console.error('Error fetching cycle data:', err);
      setError('Failed to load cycle tracking.');
    }
  };

  // 3. Save Mood
  const logMoodForDate = async (selectedMood) => {
    if (!auth?.currentUser || !selectedDate) return;

    try {
      const updatedMoods = { ...moodLogs, [selectedDate]: selectedMood };
      setMoodLogs(updatedMoods);

      // Recalculate summary counts
      const newCounts = { Happy: 0, Calm: 0, Neutral: 0, Sad: 0, Stressed: 0 };
      Object.keys(updatedMoods).forEach(date => {
        if (date.startsWith(currentMonth)) {
          const m = updatedMoods[date];
          if (newCounts[m] !== undefined) newCounts[m]++;
        }
      });
      setMoodCounts(newCounts);

      // Write to Firebase
      const moodDocRef = doc(db, 'moods', `${auth.currentUser.uid}_${selectedDate}`);
      await setDoc(moodDocRef, {
        userId: auth.currentUser.uid,
        date: selectedDate,
        mood: selectedMood,
        timestamp: new Date().toISOString()
      });

      Alert.alert('Success', `Logged mood "${selectedMood}" for ${selectedDate}.`);
    } catch (err) {
      console.error('Error saving mood:', err);
      Alert.alert('Error', 'Failed to save mood: ' + err.message);
    }
  };

  // 4. Save Cycle Logs
  const logCycleData = async (isPeriodStart, flow, symptoms) => {
    if (!auth?.currentUser || !selectedDate) return;

    try {
      const updatedCycle = {
        ...cycleLogs,
        [selectedDate]: { isPeriodStart, flow, symptoms }
      };

      // An entry with no period flag, no flow and no symptoms is a cleared day.
      const isCleared = !isPeriodStart && flow === 'None' && symptoms.length === 0;
      if (isCleared) {
        delete updatedCycle[selectedDate];
      }

      setCycleLogs(updatedCycle);

      const logDocRef = doc(db, 'cycle_logs', `${auth.currentUser.uid}_${selectedDate}`);

      if (isCleared) {
        // Previously this still wrote an empty document, so local state and
        // Firestore diverged: the cleared day reappeared as a blank entry on
        // the next load. Remove the document instead.
        await deleteDoc(logDocRef);
      } else {
        await setDoc(logDocRef, {
          userId: auth.currentUser.uid,
          date: selectedDate,
          isPeriodStart,
          flow,
          symptoms,
          timestamp: new Date().toISOString()
        });
      }

    } catch (err) {
      console.error('Error saving cycle log:', err);
      Alert.alert('Error', 'Failed to save cycle data.');
    }
  };

  // 5. Save Settings
  const saveCycleSettings = async () => {
    if (!auth?.currentUser) return;
    const cLen = parseInt(tempCycleLength, 10);
    const pLen = parseInt(tempPeriodLength, 10);

    if (isNaN(cLen) || isNaN(pLen) || cLen < 15 || cLen > 45 || pLen < 1 || pLen > 15) {
      Alert.alert('Invalid Settings', 'Cycle length must be between 15 and 45 days, and period length between 1 and 15 days.');
      return;
    }

    try {
      const newSettings = { cycleLength: cLen, periodLength: pLen };
      setCycleSettings(newSettings);
      setShowSettingsModal(false);

      const settingsDocRef = doc(db, 'cycle_settings', auth.currentUser.uid);
      await setDoc(settingsDocRef, newSettings);
      Alert.alert('Settings Saved', 'Cycle predictions updated successfully.');
    } catch (err) {
      console.error('Error saving cycle settings:', err);
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  // 6. Perform Predictions & Mark Calendar
  const getCyclePredictions = () => {
    // Find all period start dates (where isPeriodStart === true, or where flow is logged but prioritizing starts)
    const periodStarts = Object.keys(cycleLogs)
      .filter(date => cycleLogs[date].isPeriodStart || cycleLogs[date].flow !== 'None')
      .sort();

    if (periodStarts.length === 0) return { periods: [], fertile: [], ovulation: [] };

    // Get the most recent logged start date
    const latestStart = periodStarts[periodStarts.length - 1];

    const cycleLength = cycleSettings.cycleLength;
    const periodLength = cycleSettings.periodLength;

    let predictedPeriodDays = [];
    let predictedFertileDays = [];
    let predictedOvulationDays = [];

    // Predict for next 3 cycles to cover calendar view
    for (let i = 1; i <= 3; i++) {
      const nextStart = addDays(latestStart, cycleLength * i);
      const nextEnd = addDays(nextStart, periodLength - 1);
      
      // Predicted period days
      const pDays = getDaysInRange(nextStart, nextEnd);
      predictedPeriodDays.push(...pDays);

      // Predicted Ovulation (Cycle start + cycleLength - 14 days)
      const ovDay = addDays(nextStart, cycleLength - 14);
      predictedOvulationDays.push(ovDay);

      // Predicted Fertile Window (Ovulation - 4 days to Ovulation + 1 day)
      const fertStart = addDays(ovDay, -4);
      const fertEnd = addDays(ovDay, 1);
      const fDays = getDaysInRange(fertStart, fertEnd);
      predictedFertileDays.push(...fDays);
    }

    return {
      periods: predictedPeriodDays,
      fertile: predictedFertileDays,
      ovulation: predictedOvulationDays
    };
  };

  const getMarkedDates = () => {
    const marked = {};

    if (activeTab === 'mood') {
      // Mark logged moods
      Object.keys(moodLogs).forEach(date => {
        const moodVal = moodLogs[date];
        if (MOOD_CONFIG[moodVal]) {
          marked[date] = {
            selected: true,
            selectedColor: MOOD_CONFIG[moodVal].color,
            dotColor: '#fff',
            marked: true
          };
        }
      });
    } else {
      // Cycle Tracker Marking
      // 1. Mark Logged Period Days
      Object.keys(cycleLogs).forEach(date => {
        if (cycleLogs[date].flow !== 'None' || cycleLogs[date].isPeriodStart) {
          marked[date] = {
            selected: true,
            selectedColor: COLOR_PERIOD,
            textColor: '#fff',
            dotColor: '#fff',
            marked: true
          };
        }
      });

      // 2. Add Predictions
      const predictions = getCyclePredictions();
      
      // Fertile days outline/background (lowest layer priority)
      predictions.fertile.forEach(date => {
        if (!marked[date]) {
          marked[date] = {
            selected: true,
            selectedColor: COLOR_FERTILE,
            textColor: '#fff'
          };
        }
      });

      // Predicted Period days (higher layer priority)
      predictions.periods.forEach(date => {
        if (!marked[date] || marked[date].selectedColor === COLOR_FERTILE) {
          marked[date] = {
            selected: true,
            selectedColor: COLOR_PREDICTED_PERIOD,
            textColor: '#fff'
          };
        }
      });

      // Ovulation day (highest prediction layer)
      predictions.ovulation.forEach(date => {
        if (marked[date]) {
          marked[date].marked = true;
          marked[date].dotColor = COLOR_OVULATION;
        } else {
          marked[date] = {
            selected: true,
            selectedColor: COLOR_FERTILE,
            marked: true,
            dotColor: COLOR_OVULATION
          };
        }
      });
    }

    // Always highlight the currently selected date with an active outline/color
    if (selectedDate) {
      const existing = marked[selectedDate] || {};
      marked[selectedDate] = {
        ...existing,
        selected: true,
        selectedColor: activeTab === 'mood' 
          ? (existing.selectedColor || 'rgba(255, 255, 255, 0.15)') 
          : (existing.selectedColor || 'rgba(232, 131, 131, 0.15)'),
        borderColor: ACCENT_COLOR,
        borderWidth: 2
      };
    }

    return marked;
  };

  const selectedDateMood = selectedDate ? moodLogs[selectedDate] : null;
  const selectedDateCycle = selectedDate ? (cycleLogs[selectedDate] || { isPeriodStart: false, flow: 'None', symptoms: [] }) : null;

  const toggleSymptom = (symptomName) => {
    if (!selectedDate) return;
    const currentSymptoms = selectedDateCycle.symptoms;
    const newSymptoms = currentSymptoms.includes(symptomName)
      ? currentSymptoms.filter(s => s !== symptomName)
      : [...currentSymptoms, symptomName];

    logCycleData(selectedDateCycle.isPeriodStart, selectedDateCycle.flow, newSymptoms);
  };

  const setPeriodStartToggle = () => {
    if (!selectedDate) return;
    const nextVal = !selectedDateCycle.isPeriodStart;
    const nextFlow = nextVal && selectedDateCycle.flow === 'None' ? 'Medium' : selectedDateCycle.flow;
    logCycleData(nextVal, nextFlow, selectedDateCycle.symptoms);
  };

  const setFlowRate = (flowVal) => {
    if (!selectedDate) return;
    const isStart = flowVal !== 'None' ? selectedDateCycle.isPeriodStart : false;
    logCycleData(isStart, flowVal, selectedDateCycle.symptoms);
  };

  return (
    <View style={styles.container}>
      {/* Settings Modal (Cycle settings) */}
      {showSettingsModal && (
        <View style={styles.overlay}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Cycle Settings</Text>
            
            <Text style={styles.settingsLabel}>Average Cycle Length (days):</Text>
            <TextInput
              keyboardType="number-pad"
              style={styles.settingsInput}
              value={tempCycleLength}
              onChangeText={setTempCycleLength}
            />

            <Text style={styles.settingsLabel}>Period Duration (days):</Text>
            <TextInput
              keyboardType="number-pad"
              style={styles.settingsInput}
              value={tempPeriodLength}
              onChangeText={setTempPeriodLength}
            />

            <View style={styles.settingsActions}>
              <TouchableOpacity 
                style={[styles.settingsButton, { backgroundColor: '#333' }]}
                onPress={() => setShowSettingsModal(false)}
              >
                <Text style={styles.settingsButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.settingsButton, { backgroundColor: ACCENT_COLOR }]}
                onPress={saveCycleSettings}
              >
                <Text style={[styles.settingsButtonText, { color: '#111' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Toggle Mode Tab Selection */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'mood' && styles.tabButtonActive]}
            onPress={() => setActiveTab('mood')}
          >
            <Ionicons name="happy-outline" size={18} color={activeTab === 'mood' ? '#111' : '#fff'} />
            <Text style={[styles.tabButtonText, activeTab === 'mood' && { color: '#111' }]}>Mood tracker</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'cycle' && styles.tabButtonActive]}
            onPress={() => setActiveTab('cycle')}
          >
            <Ionicons name="calendar-outline" size={18} color={activeTab === 'cycle' ? '#111' : '#fff'} />
            <Text style={[styles.tabButtonText, activeTab === 'cycle' && { color: '#111' }]}>Cycle predictions</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'cycle' && (
          <TouchableOpacity 
            style={styles.settingsTrigger}
            onPress={() => setShowSettingsModal(true)}
          >
            <Ionicons name="settings-outline" size={16} color={ACCENT_COLOR} />
            <Text style={styles.settingsTriggerText}>Configure Cycle Parameters</Text>
          </TouchableOpacity>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
        
        {/* Calendar View */}
        <Animated.View style={[
          styles.calendarContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}>
          <Calendar
            style={styles.calendar}
            theme={{
              backgroundColor: '#151515',
              calendarBackground: '#151515',
              textSectionTitleColor: '#aaa',
              selectedDayBackgroundColor: ACCENT_COLOR,
              selectedDayTextColor: '#111',
              todayTextColor: ACCENT_COLOR,
              dayTextColor: '#fff',
              textDisabledColor: '#333',
              dotColor: ACCENT_COLOR,
              monthTextColor: '#fff',
              arrowColor: ACCENT_COLOR,
              indicatorColor: ACCENT_COLOR,
              textDayFontWeight: '400',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 15,
              textMonthFontSize: 17,
              textDayHeaderFontSize: 13,
            }}
            markedDates={getMarkedDates()}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            onMonthChange={(month) => {
              setCurrentMonth(month.dateString.substring(0, 7));
            }}
          />
        </Animated.View>

        {loading && (
          <ActivityIndicator size="small" color={ACCENT_COLOR} style={{ marginBottom: 15 }} />
        )}

        {/* 1. MOOD TRACKER PANEL */}
        {activeTab === 'mood' && selectedDate && (
          <Animated.View style={[styles.controlPanel, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.panelTitle}>Log Mood for: <Text style={{ color: ACCENT_COLOR }}>{selectedDate}</Text></Text>
            {selectedDateMood && (
              <Text style={styles.panelSubtitle}>Logged: {MOOD_CONFIG[selectedDateMood].emoji} {selectedDateMood}</Text>
            )}
            
            <View style={styles.moodSelectorRow}>
              {Object.keys(MOOD_CONFIG).map((moodKey) => {
                const config = MOOD_CONFIG[moodKey];
                const isSelected = selectedDateMood === moodKey;
                return (
                  <TouchableOpacity
                    key={moodKey}
                    style={[
                      styles.moodSelectorButton,
                      isSelected && { backgroundColor: config.color, borderColor: '#fff' }
                    ]}
                    onPress={() => logMoodForDate(moodKey)}
                  >
                    <Text style={styles.moodSelectorEmoji}>{config.emoji}</Text>
                    <Text style={[styles.moodSelectorLabel, isSelected && { color: '#111', fontWeight: 'bold' }]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* 2. CYCLE TRACKER PANEL */}
        {activeTab === 'cycle' && selectedDate && (
          <Animated.View style={[styles.controlPanel, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.panelTitle}>Cycle Log: <Text style={{ color: COLOR_PERIOD }}>{selectedDate}</Text></Text>
            
            {/* Period Start Date Toggle */}
            <TouchableOpacity 
              style={[styles.toggleCheckbox, selectedDateCycle.isPeriodStart && styles.toggleCheckboxActive]}
              onPress={setPeriodStartToggle}
            >
              <Ionicons 
                name={selectedDateCycle.isPeriodStart ? "checkbox" : "square-outline"} 
                size={22} 
                color={selectedDateCycle.isPeriodStart ? '#111' : '#888'} 
              />
              <Text style={[styles.toggleCheckboxText, selectedDateCycle.isPeriodStart && { color: '#111', fontWeight: '700' }]}>
                Mark as Period Start Date
              </Text>
            </TouchableOpacity>

            {/* Flow rate selector */}
            <Text style={styles.subHeader}>Period Flow Rate</Text>
            <View style={styles.flowSelectorRow}>
              {['None', 'Light', 'Medium', 'Heavy', 'Spotting'].map(flowVal => {
                const isSelected = selectedDateCycle.flow === flowVal;
                return (
                  <TouchableOpacity
                    key={flowVal}
                    style={[styles.flowChip, isSelected && styles.flowChipActive]}
                    onPress={() => setFlowRate(flowVal)}
                  >
                    <Text style={[styles.flowChipText, isSelected && { color: '#111' }]}>{flowVal}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Symptom selector */}
            <Text style={styles.subHeader}>Symptoms Experienced</Text>
            <View style={styles.symptomsGrid}>
              {[
                { name: 'Cramps', emoji: '🩸' },
                { name: 'Bloating', emoji: '🎈' },
                { name: 'Headache', emoji: '🤕' },
                { name: 'Fatigue', emoji: '🥱' },
                { name: 'Anxiety', emoji: '😟' }
              ].map(s => {
                const isSelected = selectedDateCycle.symptoms.includes(s.name);
                return (
                  <TouchableOpacity
                    key={s.name}
                    style={[styles.symptomChip, isSelected && styles.symptomChipActive]}
                    onPress={() => toggleSymptom(s.name)}
                  >
                    <Text style={styles.symptomText}>{s.emoji} {s.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Legend display */}
        {activeTab === 'cycle' && (
          <View style={styles.legendContainer}>
            <Text style={styles.legendHeader}>Calendar Legend</Text>
            <View style={styles.legendGrid}>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: COLOR_PERIOD }]} />
                <Text style={styles.legendLabel}>Logged Period</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: COLOR_PREDICTED_PERIOD }]} />
                <Text style={styles.legendLabel}>Predicted Period</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: COLOR_FERTILE }]} />
                <Text style={styles.legendLabel}>Fertile Window</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#151515', borderWidth: 1, borderColor: '#fff' }, { justifyContent: 'center', alignItems: 'center' }]}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLOR_OVULATION }} />
                </View>
                <Text style={styles.legendLabel}>Predicted Ovulation</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Animated.View style={{ transform: [{ rotate: spin }], flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.refreshButtonText}>↻ Refresh Wellness Calendar</Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Monthly summary for Mood Tracker */}
        {activeTab === 'mood' && (
          <Animated.View style={styles.moodSummary}>
            <Text style={styles.summaryTitle}>Monthly Mood Summary ({currentMonth})</Text>
            <View style={styles.moodStats}>
              {Object.keys(MOOD_CONFIG).map((moodKey) => {
                const config = MOOD_CONFIG[moodKey];
                return (
                  <View key={moodKey} style={styles.moodStat}>
                    <Text style={styles.moodEmoji}>{config.emoji}</Text>
                    <Text style={[styles.moodCount, { color: config.color }]}>
                      {moodCounts[moodKey] || 0}
                    </Text>
                    <Text style={styles.moodLabel}>{config.label}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 4,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: ACCENT_COLOR,
  },
  tabButtonText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(157, 192, 139, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(157, 192, 139, 0.2)',
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 15,
    gap: 6,
  },
  settingsTriggerText: {
    color: ACCENT_COLOR,
    fontSize: 13,
    fontWeight: '600',
  },
  calendarContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#151515',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
    elevation: 3,
  },
  calendar: {
    borderRadius: 18,
  },
  controlPanel: {
    backgroundColor: '#151515',
    padding: 18,
    borderRadius: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  panelTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  panelSubtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  subHeader: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 8,
  },
  moodSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  moodSelectorButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  moodSelectorEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  moodSelectorLabel: {
    color: '#aaa',
    fontSize: 10,
  },
  // Cycle elements
  toggleCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  toggleCheckboxActive: {
    backgroundColor: COLOR_PERIOD,
  },
  toggleCheckboxText: {
    color: '#ccc',
    fontSize: 13,
  },
  flowSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  flowChip: {
    backgroundColor: '#1e1e1e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  flowChipActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  flowChipText: {
    color: '#aaa',
    fontSize: 12,
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  symptomChip: {
    backgroundColor: '#1e1e1e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  symptomChipActive: {
    backgroundColor: '#3a3a3a',
    borderColor: ACCENT_COLOR,
  },
  symptomText: {
    color: '#ccc',
    fontSize: 12,
  },
  errorText: {
    color: '#E88383',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: 'bold',
    fontSize: 13,
  },
  refreshButton: {
    backgroundColor: '#151515',
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    marginBottom: 15,
  },
  refreshButtonText: {
    color: ACCENT_COLOR,
    fontSize: 13,
    fontWeight: '600',
  },
  moodSummary: {
    padding: 16,
    backgroundColor: '#151515',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#222',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  moodStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  moodStat: {
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  moodCount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  moodLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  // Overlay settings styles
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20,
  },
  settingsCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#333',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  settingsLabel: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 6,
    marginTop: 10,
  },
  settingsInput: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 14,
  },
  settingsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 8,
  },
  settingsButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  // Legend
  legendContainer: {
    backgroundColor: '#151515',
    padding: 15,
    borderRadius: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  legendHeader: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendLabel: {
    color: '#ccc',
    fontSize: 12,
  }
});