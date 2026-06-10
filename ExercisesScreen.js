import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
//color
const ACCENT_COLOR = '#9DC08B';

const ExerciseCard = ({ title, description, icon, duration }) => (
  <TouchableOpacity style={styles.exerciseCard}>
    <View style={styles.exerciseHeader}>
      <Ionicons name={icon} size={24} color={ACCENT_COLOR} />
      <Text style={styles.exerciseTitle}>{title}</Text>
    </View>
    <Text style={styles.exerciseDescription}>{description}</Text>
    <View style={styles.exerciseFooter}>
      <Text style={styles.exerciseDuration}>{duration} minutes</Text>
    </View>
  </TouchableOpacity>
);

const MusicServiceButton = ({ service, icon, color, url }) => (
  <TouchableOpacity 
    style={[styles.musicButton, { backgroundColor: color }]}
    onPress={() => Linking.openURL(url)}
  >
    <Ionicons name={icon} size={24} color="#fff" style={styles.musicIcon} />
    <Text style={styles.musicButtonText}>{service}</Text>
  </TouchableOpacity>
);
// exercises
export default function ExercisesScreen() {
  const exercises = [
    {
      title: 'Deep Breathing',
      description: 'Practice deep breathing exercises to reduce stress and anxiety. Inhale for 4 counts, hold for 4, exhale for 4.',
      icon: 'leaf-outline',
      duration: 5
    },
    {
      title: 'Progressive Relaxation',
      description: 'Systematically tense and relax different muscle groups to reduce physical tension.',
      icon: 'body-outline',
      duration: 10
    },
    {
      title: 'Mindful Meditation',
      description: 'Focus on the present moment and observe your thoughts without judgment.',
      icon: 'moon-outline',
      duration: 15
    },
    {
      title: 'Visualization',
      description: 'Imagine a peaceful, calming place and focus on the sensory details.',
      icon: 'image-outline',
      duration: 8
    },
    {
      title: '5-4-3-2-1 Grounding',
      description: 'Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste.',
      icon: 'compass-outline',
      duration: 5
    }
  ];

  const musicServices = [
    {
      service: 'Spotify',
      icon: 'musical-notes',
      color: '#1DB954',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY'  // Ambient Relaxation playlist
    },
    {
      service: 'Apple Music',
      icon: 'musical-note',  // Different icon for Apple Music
      color: '#FB233B',  // Apple Music red
      url: 'https://music.apple.com/us/playlist/pure-meditation/pl.f5adcd6a9fb744f989b33860d6eaffd7'  // Meditation playlist
    },
    {
      service: 'YouTube Music',
      icon: 'logo-youtube',
      color: '#FF0000',
      url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_md5JfXKvt-T5t5zQv_xkO2NoFZgUxbRCM'  // Relaxation Music playlist
    }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Coping Exercises</Text>
      <Text style={styles.headerDescription}>
        Techniques for relaxation and stress management
      </Text>

      <View style={styles.musicSection}>
        <Text style={styles.sectionTitle}>Relaxation Music</Text>
        <View style={styles.musicButtons}>
          {musicServices.map((service, index) => (
            <MusicServiceButton key={index} {...service} />
          ))}
        </View>
      </View>
      
      <ScrollView style={styles.scrollView}>
        {exercises.map((exercise, index) => (
          <ExerciseCard key={index} {...exercise} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
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
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  exerciseCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  exerciseTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  exerciseDescription: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.9,
  },
  exerciseFooter: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 15,
  },
  exerciseDuration: {
    color: ACCENT_COLOR,
    fontSize: 14,
  },
  musicSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
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
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  musicIcon: {
    marginRight: 5,
  },
  musicButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 