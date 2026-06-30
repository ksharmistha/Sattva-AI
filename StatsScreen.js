import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const ACCENT_COLOR = '#9DC08B';
const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 40;
const chartHeight = 180;

const MOOD_CONFIG = {
  Happy: { emoji: '😊', color: '#FFE17B' },
  Calm: { emoji: '😌', color: '#9DC08B' },
  Neutral: { emoji: '😐', color: '#8E9A9E' },
  Sad: { emoji: '😔', color: '#83A2E8' },
  Stressed: { emoji: '😫', color: '#E88383' }
};

const MOOD_RATINGS = {
  Happy: 5,
  Calm: 4,
  Neutral: 3,
  Sad: 2,
  Stressed: 1
};

// Custom Donut Chart Component using SVG
const MoodDonutChart = ({ counts }) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <View style={styles.donutPlaceholder}>
        <Text style={{ color: '#666', fontSize: 13 }}>No distribution data available</Text>
      </View>
    );
  }

  const radius = 45;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius; // ~282.74
  let cumulativeAngle = 0;

  return (
    <View style={styles.donutCard}>
      <View style={styles.donutWrapper}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <G transform="translate(60, 60)">
            <Circle r={radius} stroke="#222" strokeWidth={strokeWidth} fill="transparent" />
            {Object.keys(MOOD_CONFIG).map((moodKey) => {
              const count = counts[moodKey] || 0;
              if (count === 0) return null;

              const percentage = count / total;
              const strokeLength = percentage * circumference;
              const angle = percentage * 360;
              const rotation = cumulativeAngle - 90; // Start at 12 o'clock
              cumulativeAngle += angle;

              return (
                <Circle
                  key={moodKey}
                  r={radius}
                  stroke={MOOD_CONFIG[moodKey].color}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={`${strokeLength} ${circumference}`}
                  strokeDashoffset={0}
                  transform={`rotate(${rotation})`}
                />
              );
            })}
          </G>
        </Svg>
        <View style={styles.donutLabelContainer}>
          <Text style={styles.donutTotalText}>{total}</Text>
          <Text style={styles.donutSubText}>Logs</Text>
        </View>
      </View>

      <View style={styles.donutLegend}>
        {Object.keys(MOOD_CONFIG).map((moodKey) => {
          const count = counts[moodKey] || 0;
          const pct = Math.round((count / total) * 100);
          if (count === 0) return null;
          return (
            <View key={moodKey} style={styles.donutLegendItem}>
              <View style={[styles.legendDot, { backgroundColor: MOOD_CONFIG[moodKey].color }]} />
              <Text style={styles.legendText}>
                {MOOD_CONFIG[moodKey].emoji} {moodKey}: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{pct}%</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default function StatsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [todayChartData, setTodayChartData] = useState(null);
  const [weeklyChartData, setWeeklyChartData] = useState(null);
  const [moodCounts, setMoodCounts] = useState({ Happy: 0, Calm: 0, Neutral: 0, Sad: 0, Stressed: 0 });
  const [aiReport, setAiReport] = useState('');
  const [recommendedExercise, setRecommendedExercise] = useState(null);
  
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

      // Fetch mood logs
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

      const todayStr = new Date().toISOString().split('T')[0];
      
      // Calculate today's logs
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

      // Calculate weekly logs (last 7 days)
      const last7Days = [];
      const distributionCounts = { Happy: 0, Calm: 0, Neutral: 0, Sad: 0, Stressed: 0 };
      
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
          if (avg >= 3.5) { // Happy or Calm averages
            positiveDaysCount++;
          }

          // Count for distribution donut
          dayLogs.forEach(log => {
            if (distributionCounts[log.mood] !== undefined) {
              distributionCounts[log.mood]++;
            }
          });
        } else {
          weeklyRatings.push(3.0); // Neutral baseline fallback
        }
      });

      setMoodCounts(distributionCounts);

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

      // Calculate Trend compared to previous 7 days (days 8 to 14)
      const current7Avg = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount) : 0;
      
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

      // 4. Generate Local AI Wellness Insights Report
      generateWellnessReport(allLogs, current7Avg, distributionCounts);

    } catch (err) {
      console.error('Error computing stats:', err);
      setError('Failed to compute statistics.');
    } finally {
      setLoading(false);
    }
  };

  const generateWellnessReport = (allLogs, current7Avg, distribution) => {
    if (allLogs.length === 0) {
      setAiReport("Start logging your daily moods and cycles to let Sattva AI compile emotional wellness reports for you.");
      setRecommendedExercise(null);
      return;
    }

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const scoreSum = Array(7).fill(0);
    const countSum = Array(7).fill(0);

    allLogs.forEach(log => {
      if (log.timestamp) {
        const d = new Date(log.timestamp);
        const score = MOOD_RATINGS[log.mood] || 3;
        const dayIdx = d.getDay();
        scoreSum[dayIdx] += score;
        countSum[dayIdx]++;
      }
    });

    let minScore = 6;
    let worstDayIdx = -1;
    for (let i = 0; i < 7; i++) {
      if (countSum[i] > 0) {
        const avg = scoreSum[i] / countSum[i];
        if (avg < minScore) {
          minScore = avg;
          worstDayIdx = i;
        }
      }
    }

    // Determine primary mood
    let primaryMood = 'Neutral';
    let maxCount = 0;
    Object.keys(distribution).forEach(mood => {
      if (distribution[mood] > maxCount) {
        maxCount = distribution[mood];
        primaryMood = mood;
      }
    });

    // Formulate report paragraphs
    let reportText = '';
    let recommendation = { title: 'Mindfulness Meditation', id: 'meditation', icon: 'moon-outline' };

    if (current7Avg >= 4.0) {
      reportText = `Your emotional profile is exceptionally strong. With a dominant mood of "${primaryMood}" and an average mood index of ${current7Avg.toFixed(1)}/5, you are exhibiting stable mental hygiene. `;
      reportText += worstDayIdx !== -1 
        ? `We noticed a slight variance on ${weekdays[worstDayIdx]}s, but overall, you are maintaining a positive outlook. `
        : '';
      reportText += "Keep practicing meditation to anchor this peaceful mindset.";
      recommendation = { title: 'Mindfulness Meditation', id: 'meditation', icon: 'moon-outline' };
    } else if (current7Avg >= 3.0) {
      reportText = `You are maintaining a balanced emotional line. Your dominant state has been "${primaryMood}". `;
      reportText += worstDayIdx !== -1 
        ? `Stress and fatigue scores tend to rise slightly on ${weekdays[worstDayIdx]}s. `
        : '';
      reportText += "Adding brief guided breathing practices can help you stay centered through daily pressures.";
      recommendation = { title: 'Box Breathing', id: 'breathing', icon: 'leaf-outline' };
    } else {
      reportText = `Your emotional tracking suggests higher stress or sadness spikes recently, with a dominant state of "${primaryMood}". `;
      reportText += worstDayIdx !== -1 
        ? `Our analysis detects significant fatigue indices on ${weekdays[worstDayIdx]}s. `
        : 'It seems you are carrying a lot of tension. ';
      reportText += "To help prevent feeling overwhelmed, try grounding yourself dynamically in your physical environment.";
      recommendation = { title: '5-4-3-2-1 Grounding', id: 'grounding', icon: 'compass-outline' };
    }

    setAiReport(reportText);
    setRecommendedExercise(recommendation);
  };

  const chartConfig = {
    backgroundColor: '#151515',
    backgroundGradientFrom: '#151515',
    backgroundGradientTo: '#151515',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '1.5',
      stroke: ACCENT_COLOR,
    },
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Wellness Stats</Text>
        <Text style={styles.headerDescription}>Real-time mental wellness analytics and trends</Text>

        {loading ? (
          <ActivityIndicator size="large" color={ACCENT_COLOR} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            {/* Quick Stats Overview */}
            <View style={styles.statsCard}>
              <Text style={styles.statsCardTitle}>Quick Stats (7 Days)</Text>
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

            {/* AI Wellness Report */}
            <View style={styles.aiReportCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="analytics" size={20} color={ACCENT_COLOR} />
                <Text style={styles.aiReportTitle}>AI Wellness Insights</Text>
              </View>
              <Text style={styles.aiReportContent}>{aiReport}</Text>
              
              {recommendedExercise && (
                <View style={styles.recommendationBox}>
                  <Text style={styles.recLabel}>Recommended Coping Action:</Text>
                  <TouchableOpacity 
                    style={styles.recButton}
                    onPress={() => navigation.navigate('Exercises')}
                  >
                    <Ionicons name={recommendedExercise.icon} size={18} color="#111" />
                    <Text style={styles.recBtnText}>Open {recommendedExercise.title}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Mood Distribution Donut Chart */}
            <View style={styles.sectionHeaderWrapper}>
              <Text style={styles.sectionTitle}>Mood Distribution</Text>
            </View>
            <MoodDonutChart counts={moodCounts} />

            {/* Weekly Overview Line Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Weekly Mood Path</Text>
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
                    Start logging your moods this week to generate dynamic analytics graphs.
                  </Text>
                </View>
              )}
            </View>

            {/* Today's Mood Card */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Today's Mood Timeline</Text>
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
                    Log at least two moods today on the home screen to map today's emotional flow path.
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.refreshButton} onPress={fetchStats}>
              <Text style={styles.refreshButtonText}>↻ Recalculate Metrics</Text>
            </TouchableOpacity>
          </>
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
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  headerDescription: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  statsCard: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  statsCardTitle: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
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
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  aiReportCard: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  aiReportTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  aiReportContent: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18,
  },
  recommendationBox: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 15,
  },
  recLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  recButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  recBtnText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeaderWrapper: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  chartTitle: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  chart: {
    marginVertical: 4,
    borderRadius: 16,
  },
  placeholderCard: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  placeholderEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
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
  errorText: {
    color: '#E88383',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: 'bold',
  },
  // Donut chart elements
  donutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  donutPlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutLabelContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutTotalText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  donutSubText: {
    fontSize: 11,
    color: '#666',
  },
  donutLegend: {
    flex: 1,
    paddingLeft: 20,
    gap: 8,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#aaa',
    fontSize: 12,
  }
});