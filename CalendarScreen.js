import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

const ACCENT_COLOR = '#9DC08B';  // Mint green to match App.js

// Mood styling configuration
const MOOD_CONFIG = {
  Happy: { emoji: '😊', color: '#FFE17B', label: 'Happy' },
  Calm: { emoji: '😌', color: '#9DC08B', label: 'Calm' },
  Neutral: { emoji: '😐', color: '#8E9A9E', label: 'Neutral' },
  Sad: { emoji: '😔', color: '#83A2E8', label: 'Sad' },
  Stressed: { emoji: '😫', color: '#E88383', label: 'Stressed' }
};

export default function CalendarScreen() {
  const [markedDates, setMarkedDates] = useState({});
  const [moodCounts, setMoodCounts] = useState({ Happy: 0, Calm: 0, Neutral: 0, Sad: 0, Stressed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const summarySlideAnim = useRef(new Animated.Value(100)).current;
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
      Animated.spring(summarySlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    fetchMoodData();
  }, [currentMonth]);

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
      fetchMoodData();
    });
  };

  const fetchMoodData = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Query moods for the logged-in user
      const q = query(
        collection(db, 'moods'),
        where('userId', '==', auth.currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const dates = {};
      const newCounts = { Happy: 0, Calm: 0, Neutral: 0, Sad: 0, Stressed: 0 };

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // data.date is expected in YYYY-MM-DD format
        if (data.date && data.mood && MOOD_CONFIG[data.mood]) {
          const config = MOOD_CONFIG[data.mood];
          dates[data.date] = {
            selected: true,
            selectedColor: config.color,
            marked: true,
            dotColor: '#fff',
            mood: data.mood
          };

          // Filter counts for current month (YYYY-MM)
          if (data.date.startsWith(currentMonth)) {
            newCounts[data.mood] = (newCounts[data.mood] || 0) + 1;
          }
        }
      });

      setMarkedDates(dates);
      setMoodCounts(newCounts);
    } catch (err) {
      console.error('Error fetching moods:', err);
      setError('Failed to load mood data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const logMoodForDate = async (selectedMood) => {
    if (!auth.currentUser || !selectedDate) return;

    try {
      setError(null);
      const config = MOOD_CONFIG[selectedMood];

      // Update local state immediately for instant feedback
      const newMarkedDates = {
        ...markedDates,
        [selectedDate]: {
          selected: true,
          selectedColor: config.color,
          marked: true,
          dotColor: '#fff',
          mood: selectedMood
        }
      };
      setMarkedDates(newMarkedDates);

      // Recalculate counts locally
      const updatedCounts = { Happy: 0, Calm: 0, Neutral: 0, Sad: 0, Stressed: 0 };
      Object.keys(newMarkedDates).forEach(date => {
        if (date.startsWith(currentMonth)) {
          const mood = newMarkedDates[date].mood;
          if (mood && updatedCounts[mood] !== undefined) {
            updatedCounts[mood]++;
          }
        }
      });
      setMoodCounts(updatedCounts);

      // Write to Firestore with a unique document per user/date to avoid duplicates
      const moodDocRef = doc(db, 'moods', `${auth.currentUser.uid}_${selectedDate}`);
      await setDoc(moodDocRef, {
        userId: auth.currentUser.uid,
        date: selectedDate,
        mood: selectedMood,
        timestamp: new Date().toISOString()
      });

      Alert.alert('Mood Saved', `Successfully logged "${selectedMood}" for ${selectedDate}.`);
    } catch (err) {
      console.error('Error saving mood:', err);
      setError('Error saving mood: ' + err.message);
    }
  };

  const selectedDayMood = selectedDate && markedDates[selectedDate] 
    ? markedDates[selectedDate].mood 
    : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}>
          <Text style={styles.headerTitle}>Mood Calendar</Text>
          <Text style={styles.headerDescription}>Track and review your emotional history daily.</Text>
        </Animated.View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        
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
              backgroundColor: '#1a1a1a',
              calendarBackground: '#1a1a1a',
              textSectionTitleColor: '#aaa',
              selectedDayBackgroundColor: ACCENT_COLOR,
              selectedDayTextColor: '#111',
              todayTextColor: ACCENT_COLOR,
              dayTextColor: '#fff',
              textDisabledColor: '#444',
              dotColor: ACCENT_COLOR,
              monthTextColor: '#fff',
              arrowColor: ACCENT_COLOR,
              indicatorColor: ACCENT_COLOR,
              textDayFontWeight: '300',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 14,
            }}
            markedDates={markedDates}
            onDayPress={onDayPress}
            onMonthChange={(month) => {
              setCurrentMonth(month.dateString.substring(0, 7));
            }}
          />
        </Animated.View>

        {loading && (
          <ActivityIndicator size="small" color={ACCENT_COLOR} style={{ marginBottom: 20 }} />
        )}

        {selectedDate && (
          <Animated.View 
            style={[
              styles.selectedDateContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <Text style={styles.selectedDateText}>
              Log Mood for: <Text style={{ fontWeight: 'bold', color: ACCENT_COLOR }}>{selectedDate}</Text>
            </Text>
            {selectedDayMood && (
              <Text style={styles.currentLoggedMood}>
                Current Log: {MOOD_CONFIG[selectedDayMood].emoji} {selectedDayMood}
              </Text>
            )}
            <View style={styles.moodSelectorRow}>
              {Object.keys(MOOD_CONFIG).map((moodKey) => {
                const config = MOOD_CONFIG[moodKey];
                const isSelected = selectedDayMood === moodKey;
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

        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Animated.View style={{ transform: [{ rotate: spin }], flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.refreshButtonText}>↻ Refresh Data</Text>
          </Animated.View>
        </TouchableOpacity>

        <Animated.View 
          style={[
            styles.moodSummary,
            {
              opacity: fadeAnim,
              transform: [{ translateY: summarySlideAnim }],
            }
          ]}
        >
          <Text style={styles.summaryTitle}>Monthly Summary ({currentMonth})</Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  calendarContainer: {
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calendar: {
    borderRadius: 15,
  },
  selectedDateContainer: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  selectedDateText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  currentLoggedMood: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 15,
    fontStyle: 'italic',
  },
  moodSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 8,
  },
  moodSelectorButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  moodSelectorEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  moodSelectorLabel: {
    color: '#ccc',
    fontSize: 10,
  },
  errorText: {
    color: '#E88383',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#222',
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    marginBottom: 20,
  },
  refreshButtonText: {
    color: ACCENT_COLOR,
    fontSize: 15,
    fontWeight: '600',
  },
  moodSummary: {
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
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
    fontSize: 26,
    marginBottom: 5,
  },
  moodCount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  moodLabel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 5,
  },
  headerContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerDescription: {
    color: '#999',
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
});