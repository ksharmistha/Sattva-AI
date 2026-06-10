import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './firebase';

const ACCENT_COLOR = '#9DC08B';
const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 40;
const chartHeight = 200;

const MOOD_RATINGS = {
  Happy: 5,
  Calm: 4,
  Neutral: 3,
  Sad: 2,
  Stressed: 1
};

export default function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [todayChartData, setTodayChartData] = useState(null);
  const [weeklyChartData, setWeeklyChartData] = useState(null);
  const [stats, setStats] = useState({
    averageMood: 'N/A',
    trend: '0%',
    positiveDays: '0%'
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch all mood logs for current user ordered by timestamp
      const q = query(
        collection(db, 'moods'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('timestamp', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const allLogs = [];
      querySnapshot.forEach(doc => {
        allLogs.push(doc.data());
      });

      // Local Dates calculation
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Calculate today's data points
      const todayLogs = allLogs.filter(log => log.date === todayStr);
      if (todayLogs.length > 0) {
        const labels = todayLogs.map(log => {
          if (!log.timestamp) return 'Time';
          const date = new Date(log.timestamp);
          return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        });
        const ratings = todayLogs.map(log => MOOD_RATINGS[log.mood] || 3);
        
        setTodayChartData({
          labels,
          datasets: [{
            data: ratings,
            color: (opacity = 1) => ACCENT_COLOR,
          }]
        });
      } else {
        setTodayChartData(null);
      }

      // Calculate weekly data (last 7 days)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push({
          dateStr: d.toISOString().split('T')[0],
          label: d.toLocaleDateString([], { weekday: 'short' })
        });
      }

      const weeklyRatings = [];
      const weeklyLabels = [];
      let totalRatingSum = 0;
      let totalRatingCount = 0;
      let positiveDaysCount = 0;

      last7Days.forEach(day => {
        const dayLogs = allLogs.filter(log => log.date === day.dateStr);
        weeklyLabels.push(day.label);
        
        if (dayLogs.length > 0) {
          const sum = dayLogs.reduce((acc, log) => acc + (MOOD_RATINGS[log.mood] || 3), 0);
          const avg = sum / dayLogs.length;
          weeklyRatings.push(Number(avg.toFixed(1)));
          
          totalRatingSum += sum;
          totalRatingCount += dayLogs.length;
          if (avg >= 3.5) { // Happy or Calm
            positiveDaysCount++;
          }
        } else {
          // Fallback if no data logged for that day (keep it flat/neutral or previous value)
          weeklyRatings.push(3.0);
        }
      });

      const hasWeeklyLogs = allLogs.some(log => {
        const logDate = new Date(log.date);
        const diffTime = Math.abs(new Date() - logDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      });

      if (hasWeeklyLogs) {
        setWeeklyChartData({
          labels: weeklyLabels,
          datasets: [{
            data: weeklyRatings,
            color: (opacity = 1) => ACCENT_COLOR,
          }]
        });
      } else {
        setWeeklyChartData(null);
      }

      // Calculate Trend (compare last 7 days vs previous 7 days)
      // Current 7 days average
      const current7Avg = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount) : 0;
      
      // Previous 7 days (days 8 to 14)
      const prev7Days = [];
      for (let i = 13; i >= 7; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        prev7Days.push(d.toISOString().split('T')[0]);
      }
      const prevLogs = allLogs.filter(log => prev7Days.includes(log.date));
      const prevAvg = prevLogs.length > 0
        ? (prevLogs.reduce((acc, log) => acc + (MOOD_RATINGS[log.mood] || 3), 0) / prevLogs.length)
        : 0;

      let trendPercentageStr = '0%';
      if (prevAvg > 0 && current7Avg > 0) {
        const pctDiff = ((current7Avg - prevAvg) / prevAvg) * 100;
        trendPercentageStr = `${pctDiff >= 0 ? '+' : ''}${Math.round(pctDiff)}%`;
      } else if (current7Avg > 0) {
        trendPercentageStr = '+100%';
      }

      // Populate Quick Stats
      setStats({
        averageMood: current7Avg > 0 ? current7Avg.toFixed(1) : 'N/A',
        trend: trendPercentageStr,
        positiveDays: current7Avg > 0 ? `${Math.round((positiveDaysCount / 7) * 100)}%` : '0%'
      });

    } catch (err) {
      console.error('Error computing stats:', err);
      setError('Failed to compute statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    backgroundColor: '#1a1a1a',
    backgroundGradientFrom: '#1a1a1a',
    backgroundGradientTo: '#1a1a1a',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: ACCENT_COLOR,
    },
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.content}>
          <Text style={styles.headerTitle}>Mood Statistics</Text>
          <Text style={styles.headerDescription}>Track your emotional well-being over time</Text>

          {loading ? (
            <ActivityIndicator size="large" color={ACCENT_COLOR} style={{ marginTop: 40 }} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              {/* Today's Mood Card */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Today's Mood Path</Text>
                {todayChartData && todayChartData.datasets[0].data.length >= 2 ? (
                  <LineChart
                    data={todayChartData}
                    width={chartWidth}
                    height={chartHeight}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                  />
                ) : (
                  <View style={styles.placeholderCard}>
                    <Text style={styles.placeholderEmoji}>🌱</Text>
                    <Text style={styles.placeholderText}>
                      Log at least two moods today on the home screen to see today's visual emotional trend!
                    </Text>
                  </View>
                )}
                <View style={styles.legendContainer}>
                  <Text style={styles.legendText}>Scale: 1 (Stressed) to 5 (Happy)</Text>
                </View>
              </View>

              {/* Weekly Overview Card */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Weekly Overview</Text>
                {weeklyChartData ? (
                  <LineChart
                    data={weeklyChartData}
                    width={chartWidth}
                    height={chartHeight}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                  />
                ) : (
                  <View style={styles.placeholderCard}>
                    <Text style={styles.placeholderEmoji}>📊</Text>
                    <Text style={styles.placeholderText}>
                      Start logging your moods this week to generate your dynamic analytics graphs.
                    </Text>
                  </View>
                )}
              </View>

              {/* Quick Stats Card */}
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>Quick Stats (7 Days)</Text>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.averageMood}</Text>
                    <Text style={styles.statLabel}>Avg Mood</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[
                      styles.statValue, 
                      stats.trend.startsWith('+') && stats.trend !== '+0%' ? { color: '#9DC08B' } : 
                      stats.trend.startsWith('-') ? { color: '#E88383' } : { color: '#fff' }
                    ]}>
                      {stats.trend}
                    </Text>
                    <Text style={styles.statLabel}>Weekly Trend</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.positiveDays}</Text>
                    <Text style={styles.statLabel}>Positive Days</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.refreshButton} onPress={fetchStats}>
                <Text style={styles.refreshButtonText}>↻ Refresh Analytics</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  content: {
    padding: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerDescription: {
    color: '#999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  chartCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '100%',
  },
  chartTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    width: '100%',
  },
  placeholderCard: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  placeholderEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  placeholderText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  legendContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  legendText: {
    color: '#777',
    fontSize: 13,
  },
  statsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  statsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: ACCENT_COLOR,
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 5,
  },
  errorText: {
    color: '#E88383',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#222',
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  refreshButtonText: {
    color: ACCENT_COLOR,
    fontSize: 15,
    fontWeight: '600',
  },
});