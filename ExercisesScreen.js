import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking, 
  Modal, 
  Animated, 
  Easing, 
  TextInput, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT_COLOR = '#9DC08B'; // Mint green

export default function ExercisesScreen() {
  const [activeActivity, setActiveActivity] = useState(null); // 'breathing', 'grounding', 'meditation', or null

  // 1. Box Breathing States
  const [breathPhase, setBreathPhase] = useState('Ready'); // 'Ready', 'Inhale', 'Hold (Full)', 'Exhale', 'Hold (Empty)', 'Finished'
  const [breathTimer, setBreathTimer] = useState(4);
  const [breathRound, setBreathRound] = useState(1);
  const [breathTotalRounds, setBreathTotalRounds] = useState(4);
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const breathAnim = useRef(new Animated.Value(1)).current; // scale between 1 and 2.2
  const breathTimerRef = useRef(null);

  // 2. Grounding (5-4-3-2-1) States
  const [groundingStep, setGroundingStep] = useState(5); // counts down from 5 to 1, then 'done'
  const [groundingInputs, setGroundingInputs] = useState(Array(5).fill('')); // stores text values for active step
  const [groundingAnswers, setGroundingAnswers] = useState({ 5: [], 4: [], 3: [], 2: [], 1: [] });

  // 3. Meditation States
  const [medDuration, setMedDuration] = useState(5); // duration in minutes
  const [medTimeLeft, setMedTimeLeft] = useState(300); // duration in seconds
  const [isMedActive, setIsMedActive] = useState(false);
  const [medQuote, setMedQuote] = useState('Breathe in peace, release expectation.');
  const medTimerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current; // pulse animation for meditation focus point

  const meditationQuotes = [
    "Breathe in peace, release expectation.",
    "Be here now. This moment is exactly as it should be.",
    "Quiet the mind, and let your body ground itself.",
    "Thoughts are like clouds; watch them float by without judgment.",
    "Feel the contact of your body on the seat or floor.",
    "Allow yourself to simply be, without having to achieve anything.",
    "With each exhale, let go of any tension in your shoulders.",
    "You are safe, you are present, you are whole."
  ];

  // --- 1. Box Breathing Logic ---
  useEffect(() => {
    if (isBreathingActive) {
      breathTimerRef.current = setInterval(() => {
        setBreathTimer((prev) => {
          if (prev > 1) return prev - 1;
          
          // Phase transitions
          setBreathPhase((currentPhase) => {
            switch (currentPhase) {
              case 'Ready':
              case 'Hold (Empty)':
                // Transition to Inhale
                animateBreath(2.2, 4000);
                return 'Inhale';
              case 'Inhale':
                // Transition to Hold (Full)
                return 'Hold (Full)';
              case 'Hold (Full)':
                // Transition to Exhale
                animateBreath(1.0, 4000);
                return 'Exhale';
              case 'Exhale':
                // Transition to Hold (Empty)
                if (breathRound >= breathTotalRounds) {
                  setIsBreathingActive(false);
                  clearInterval(breathTimerRef.current);
                  return 'Finished';
                }
                setBreathRound((r) => r + 1);
                return 'Hold (Empty)';
              default:
                return 'Ready';
            }
          });
          return 4; // reset 4s timer
        });
      }, 1000);
    } else {
      clearInterval(breathTimerRef.current);
    }
    return () => clearInterval(breathTimerRef.current);
  }, [isBreathingActive, breathRound, breathTotalRounds]);

  const animateBreath = (toValue, duration) => {
    Animated.timing(breathAnim, {
      toValue: toValue,
      duration: duration,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
      useNativeDriver: true,
    }).start();
  };

  const startBreathing = () => {
    setBreathPhase('Ready');
    setBreathTimer(4);
    setBreathRound(1);
    setIsBreathingActive(true);
    animateBreath(1.0, 0); // reset scale
  };

  const pauseBreathing = () => {
    setIsBreathingActive(false);
  };

  const resetBreathing = () => {
    setIsBreathingActive(false);
    setBreathPhase('Ready');
    setBreathTimer(4);
    setBreathRound(1);
    animateBreath(1.0, 300);
  };

  // --- 2. Grounding (5-4-3-2-1) Logic ---
  const handleGroundingNext = () => {
    // Validate inputs
    const filledInputs = groundingInputs.filter(val => val.trim().length > 0);
    if (filledInputs.length < groundingStep) {
      Alert.alert('Incomplete Step', `Please write notes for all ${groundingStep} items to help anchor your focus.`);
      return;
    }

    // Save inputs
    setGroundingAnswers(prev => ({
      ...prev,
      [groundingStep]: filledInputs
    }));

    // Move to next step
    if (groundingStep > 1) {
      const nextStep = groundingStep - 1;
      setGroundingStep(nextStep);
      setGroundingInputs(Array(nextStep).fill('')); // initialize array size for next step
    } else {
      setGroundingStep('done');
    }
  };

  const resetGrounding = () => {
    setGroundingStep(5);
    setGroundingInputs(Array(5).fill(''));
    setGroundingAnswers({ 5: [], 4: [], 3: [], 2: [], 1: [] });
  };

  // --- 3. Meditation Logic ---
  // Pulse animation loop
  useEffect(() => {
    let loop;
    if (isMedActive) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.8,
            duration: 3500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 3500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => loop && loop.stop();
  }, [isMedActive]);

  useEffect(() => {
    if (isMedActive) {
      medTimerRef.current = setInterval(() => {
        setMedTimeLeft((prev) => {
          if (prev <= 1) {
            setIsMedActive(false);
            clearInterval(medTimerRef.current);
            Alert.alert('Session Complete', 'You have finished your meditation. Take a deep breath and return gently.');
            return 0;
          }
          // Shift quotes randomly every 60 seconds
          if (prev % 60 === 0) {
            const nextQuote = meditationQuotes[Math.floor(Math.random() * meditationQuotes.length)];
            setMedQuote(nextQuote);
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(medTimerRef.current);
    }
    return () => clearInterval(medTimerRef.current);
  }, [isMedActive]);

  const selectMedDuration = (mins) => {
    setMedDuration(mins);
    setMedTimeLeft(mins * 60);
    setIsMedActive(false);
  };

  const startMeditation = () => {
    setIsMedActive(true);
    setMedQuote(meditationQuotes[0]);
  };

  const pauseMeditation = () => {
    setIsMedActive(false);
  };

  const resetMeditation = () => {
    setIsMedActive(false);
    setMedTimeLeft(medDuration * 60);
  };

  const formatMedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Main list configurations
  const exercises = [
    {
      id: 'breathing',
      title: 'Box Breathing',
      description: 'Used by professionals to reduce stress instantly. Visual expanding bubble guides you to inhale, hold, exhale, and hold.',
      icon: 'leaf-outline',
      duration: '4-8 mins'
    },
    {
      id: 'grounding',
      title: '5-4-3-2-1 Grounding',
      description: 'Step-by-step interactive questionnaire to anchor your mind to the physical world during severe anxiety.',
      icon: 'compass-outline',
      duration: '5 mins'
    },
    {
      id: 'meditation',
      title: 'Mindfulness Meditation',
      description: 'Guided meditation timer with visual breathing synchronization point and minute-by-minute wisdom quotes.',
      icon: 'moon-outline',
      duration: '2-15 mins'
    }
  ];

  const musicPlaylists = [
    { name: 'Spotify Relax', icon: 'musical-notes', color: '#1DB954', url: 'https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY' },
    { name: 'Apple Calm', icon: 'musical-note', color: '#FB233B', url: 'https://music.apple.com/us/playlist/pure-meditation/pl.f5adcd6a9fb744f989b33860d6eaffd7' },
    { name: 'YouTube Ambient', icon: 'logo-youtube', color: '#FF0000', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_md5JfXKvt-T5t5zQv_xkO2NoFZgUxbRCM' }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Wellness Gym</Text>
      <Text style={styles.headerDescription}>Interactive techniques to calm the mind and manage distress</Text>

      {/* Playlists section */}
      <View style={styles.musicSection}>
        <Text style={styles.sectionTitle}>Soothing Music Playlists</Text>
        <View style={styles.musicButtons}>
          {musicPlaylists.map((pl, i) => (
            <TouchableOpacity 
              key={i} 
              style={[styles.musicButton, { backgroundColor: pl.color }]} 
              onPress={() => Linking.openURL(pl.url)}
            >
              <Ionicons name={pl.icon} size={20} color="#fff" />
              <Text style={styles.musicText}>{pl.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Exercises Lists */}
      <ScrollView style={styles.scrollView}>
        <Text style={styles.sectionTitle}>Active Exercises</Text>
        {exercises.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.exerciseCard}
            onPress={() => {
              setActiveActivity(item.id);
              if (item.id === 'breathing') resetBreathing();
              if (item.id === 'grounding') resetGrounding();
              if (item.id === 'meditation') resetMeditation();
            }}
          >
            <View style={styles.exerciseHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name={item.icon} size={24} color={ACCENT_COLOR} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseTitle}>{item.title}</Text>
                <Text style={styles.exerciseDuration}>{item.duration}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#555" />
            </View>
            <Text style={styles.exerciseDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* --- 1. MODAL BOX BREATHING --- */}
      <Modal visible={activeActivity === 'breathing'} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveActivity(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Box Breathing</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalContent}>
            {/* Round & Cycle Info */}
            <View style={styles.breathingStats}>
              <Text style={styles.statLabel}>Round: <Text style={{ color: ACCENT_COLOR, fontWeight: 'bold' }}>{breathRound} / {breathTotalRounds}</Text></Text>
              <Text style={styles.statLabel}>Timer: <Text style={{ color: ACCENT_COLOR, fontWeight: 'bold' }}>{breathPhase === 'Ready' || breathPhase === 'Finished' ? '-' : `${breathTimer}s`}</Text></Text>
            </View>

            {/* Bubble Graphic */}
            <View style={styles.bubbleArea}>
              <Animated.View style={[
                styles.bubbleOuter,
                { transform: [{ scale: breathAnim }] }
              ]}>
                <View style={styles.bubbleInner}>
                  <Text style={styles.bubblePhaseText}>{breathPhase}</Text>
                  {isBreathingActive && (
                    <Text style={styles.bubbleTimerText}>{breathTimer}</Text>
                  )}
                </View>
              </Animated.View>
            </View>

            {/* Guidance descriptions */}
            <Text style={styles.breathingDesc}>
              {breathPhase === 'Ready' && 'Prepare yourself. Set your rounds and press Start.'}
              {breathPhase === 'Inhale' && 'Slowly fill your lungs with air... expand your belly.'}
              {breathPhase === 'Hold (Full)' && 'Gently hold that air inside. Feel the stillness.'}
              {breathPhase === 'Exhale' && 'Sigh the breath out... slowly release the pressure.'}
              {breathPhase === 'Hold (Empty)' && 'Hold the breath empty... wait in calm.'}
              {breathPhase === 'Finished' && 'Exercise completed. Notice how much calmer you feel.'}
            </Text>

            {/* Setup Controls */}
            {breathPhase === 'Ready' && (
              <View style={styles.roundsConfig}>
                <Text style={{ color: '#aaa', fontSize: 14 }}>Rounds to complete:</Text>
                <View style={styles.roundsButtons}>
                  {[2, 4, 8, 12].map(r => (
                    <TouchableOpacity 
                      key={r}
                      style={[styles.roundsChip, breathTotalRounds === r && styles.roundsChipActive]}
                      onPress={() => setBreathTotalRounds(r)}
                    >
                      <Text style={[styles.roundsChipText, breathTotalRounds === r && { color: '#111' }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              {!isBreathingActive ? (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ACCENT_COLOR }]} onPress={startBreathing}>
                  <Ionicons name="play" size={20} color="#111" />
                  <Text style={[styles.actionBtnText, { color: '#111' }]}>Start</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#444' }]} onPress={pauseBreathing}>
                  <Ionicons name="pause" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Pause</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#222', borderWidth: 1, borderColor: '#333' }]} onPress={resetBreathing}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- 2. MODAL GROUNDING 5-4-3-2-1 --- */}
      <Modal visible={activeActivity === 'grounding'} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveActivity(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Grounding Exercise</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.groundingContainer}>
            {groundingStep !== 'done' ? (
              <View style={{ width: '100%' }}>
                <Text style={styles.groundingGuide}>
                  Look around you and observe your immediate environment. Name:
                </Text>
                
                <Text style={styles.groundingStepHeader}>
                  {groundingStep} {groundingStep === 5 ? 'Things you can SEE 👀' : 
                                  groundingStep === 4 ? 'Things you can TOUCH 🖐️' :
                                  groundingStep === 3 ? 'Things you can HEAR 👂' :
                                  groundingStep === 2 ? 'Things you can SMELL 👃' :
                                  'Thing you can TASTE 👅'}
                </Text>

                {/* Generate text inputs based on current count */}
                {Array.from({ length: groundingStep }).map((_, idx) => (
                  <View key={idx} style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>{idx + 1}.</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder={`Describe item ${idx + 1}...`}
                      placeholderTextColor="#555"
                      value={groundingInputs[idx] || ''}
                      onChangeText={(text) => {
                        const newInputs = [...groundingInputs];
                        newInputs[idx] = text;
                        setGroundingInputs(newInputs);
                      }}
                    />
                  </View>
                ))}

                <TouchableOpacity style={styles.groundingNextBtn} onPress={handleGroundingNext}>
                  <Text style={styles.groundingNextText}>
                    {groundingStep > 1 ? 'Save and Continue' : 'Finish Exercise'}
                  </Text>
                  <Ionicons name="arrow-forward-outline" size={18} color="#111" />
                </TouchableOpacity>
              </View>
            ) : (
              // Done view
              <View style={styles.doneContainer}>
                <Ionicons name="checkmark-circle-outline" size={80} color={ACCENT_COLOR} />
                <Text style={styles.doneTitle}>Well Grounded</Text>
                <Text style={styles.doneSubtitle}>
                  Excellent. You have brought your consciousness back to your body and your surroundings. Notice the calmness in your breathing.
                </Text>
                
                <View style={styles.answersCard}>
                  <Text style={styles.answersHeader}>Your Senses Summary:</Text>
                  {Object.keys(groundingAnswers).reverse().map((step) => (
                    <Text key={step} style={styles.summaryAnswerLine}>
                      {step} {step === 5 ? 'Seen' : step === 4 ? 'Touched' : step === 3 ? 'Heard' : step === 2 ? 'Smelled' : 'Tasted'}: {groundingAnswers[step].join(', ')}
                    </Text>
                  ))}
                </View>

                <TouchableOpacity style={[styles.groundingNextBtn, { width: '80%', marginTop: 20 }]} onPress={resetGrounding}>
                  <Text style={styles.groundingNextText}>Repeat Exercise</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* --- 3. MODAL MEDITATION TIMER --- */}
      <Modal visible={activeActivity === 'meditation'} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveActivity(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Mindful Meditation</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalContent}>
            {/* Quote Ticker */}
            <View style={styles.quoteCard}>
              <Ionicons name="quote" size={24} color={ACCENT_COLOR} style={{ opacity: 0.3, marginBottom: 8 }} />
              <Text style={styles.medQuoteText}>{medQuote}</Text>
            </View>

            {/* Time display */}
            <Text style={styles.timeText}>{formatMedTime(medTimeLeft)}</Text>

            {/* Pulsing Eye Focus Object */}
            <View style={styles.medCircleWrapper}>
              <Animated.View style={[
                styles.medCircleOuter,
                { transform: [{ scale: pulseAnim }] }
              ]}>
                <View style={styles.medCircleInner}>
                  <Ionicons name="eye-outline" size={24} color="#111" />
                </View>
              </Animated.View>
              <Text style={styles.focusLabel}>Focus point. Synced to slow breathing.</Text>
            </View>

            {/* Duration Selector */}
            {!isMedActive && medTimeLeft === medDuration * 60 && (
              <View style={styles.durationsSelector}>
                <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 10 }}>Session Length (minutes):</Text>
                <View style={styles.durationsRow}>
                  {[2, 5, 10, 15].map(mins => (
                    <TouchableOpacity 
                      key={mins} 
                      style={[styles.durationChip, medDuration === mins && styles.durationChipActive]}
                      onPress={() => selectMedDuration(mins)}
                    >
                      <Text style={[styles.durationChipText, medDuration === mins && { color: '#111' }]}>{mins}m</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Controls */}
            <View style={styles.actionsRow}>
              {!isMedActive ? (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ACCENT_COLOR }]} onPress={startMeditation}>
                  <Ionicons name="play" size={20} color="#111" />
                  <Text style={[styles.actionBtnText, { color: '#111' }]}>Start Session</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#444' }]} onPress={pauseMeditation}>
                  <Ionicons name="pause" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Pause</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#222', borderWidth: 1, borderColor: '#333' }]} onPress={resetMeditation}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    padding: 15,
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
  scrollView: {
    flex: 1,
  },
  musicSection: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  musicButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  musicButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  musicText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  exerciseCard: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(157, 192, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseDuration: {
    color: ACCENT_COLOR,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  exerciseDescription: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  // Modal Base styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#111',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  // Breathing details
  breathingStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  statLabel: {
    color: '#aaa',
    fontSize: 14,
  },
  bubbleArea: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  bubbleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(157, 192, 139, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ACCENT_COLOR,
  },
  bubbleInner: {
    width: '90%',
    height: '90%',
    borderRadius: 50,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubblePhaseText: {
    color: '#0d0d0d',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bubbleTimerText: {
    color: '#0d0d0d',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  breathingDesc: {
    color: '#bbb',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    height: 50,
  },
  roundsConfig: {
    alignItems: 'center',
    width: '100%',
  },
  roundsButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  roundsChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#333',
  },
  roundsChipActive: {
    backgroundColor: ACCENT_COLOR,
  },
  roundsChipText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Grounding styles
  groundingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  groundingGuide: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  groundingStepHeader: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 12,
    paddingHorizontal: 12,
    width: '100%',
  },
  inputLabel: {
    color: ACCENT_COLOR,
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    fontSize: 14,
  },
  groundingNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    marginTop: 20,
    gap: 8,
  },
  groundingNextText: {
    color: '#111',
    fontSize: 15,
    fontWeight: 'bold',
  },
  doneContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 20,
  },
  doneTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
  },
  doneSubtitle: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 15,
    marginBottom: 24,
  },
  answersCard: {
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#222',
  },
  answersHeader: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  summaryAnswerLine: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  // Meditation styles
  quoteCard: {
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 18,
    width: '90%',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#333',
  },
  medQuoteText: {
    color: '#eee',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  timeText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: 2,
    marginVertical: 20,
  },
  medCircleWrapper: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medCircleOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(157, 192, 139, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
  },
  medCircleInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusLabel: {
    color: '#555',
    fontSize: 11,
    marginTop: 15,
  },
  durationsSelector: {
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  durationsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#333',
  },
  durationChipActive: {
    backgroundColor: ACCENT_COLOR,
  },
  durationChipText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  }
});