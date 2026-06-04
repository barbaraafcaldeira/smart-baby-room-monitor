import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE_URL = 'https://brq754wbx0.execute-api.eu-west-2.amazonaws.com';
const DEVICE_ID = 'smart-baby-monitor-esp32';
const REFRESH_MS = 5000;

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value) {
  return value === true || value === 'true';
}

function formatTime(timestamp) {
  const numeric = asNumber(timestamp);
  if (!numeric) return 'No timestamp';

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
  }).format(new Date(numeric * 1000));
}

function normaliseReading(reading) {
  if (!reading) return null;

  return {
    ...reading,
    temperature: asNumber(reading.temperature),
    humidity: asNumber(reading.humidity),
    distanceCm: asNumber(reading.distanceCm),
    lightValue: asNumber(reading.lightValue),
    noiseValue: asNumber(reading.noiseValue),
    motion: asBoolean(reading.motion),
    crying: asBoolean(reading.crying),
    fanOn: asBoolean(reading.fanOn),
    heaterOn: asBoolean(reading.heaterOn),
    cribRocking: asBoolean(reading.cribRocking),
    alert: asBoolean(reading.alert),
    buzzerSilenced: asBoolean(reading.buzzerSilenced),
  };
}

function MetricCard({ label, value, detail, alert }) {
  return (
    <View style={[styles.metricCard, alert && styles.metricCardAlert]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function CommandButton({ label, detail, danger, disabled, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.commandButton,
        danger && styles.commandDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[styles.commandLabel, danger && styles.commandDangerText]}>{label}</Text>
      <Text style={styles.commandDetail}>{detail}</Text>
    </Pressable>
  );
}

function TemperatureTrend({ readings }) {
  const points = readings
    .slice()
    .reverse()
    .map((item) => asNumber(item.temperature));
  const max = Math.max(...points, 30);
  const min = Math.min(...points, 15);
  const range = Math.max(max - min, 1);

  return (
    <View style={styles.trendBars}>
      {points.map((value, index) => {
        const height = 22 + ((value - min) / range) * 86;
        return (
          <View key={`${value}-${index}`} style={styles.trendItem}>
            <View style={[styles.trendBar, { height }]} />
            <Text style={styles.trendLabel}>{value.toFixed(0)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function App() {
  const [latest, setLatest] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingCommand, setSendingCommand] = useState(false);
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  async function fetchReadings() {
    try {
      setRefreshing(true);
      const response = await fetch(`${API_BASE_URL}/readings`);
      if (!response.ok) throw new Error(`Readings request failed with ${response.status}`);
      const data = await response.json();
      setLatest(normaliseReading(data.latest));
      setReadings((data.readings || []).map(normaliseReading).filter(Boolean));
      setLastRefresh(new Date());
    } catch (error) {
      setStatusMessage(error.message || 'Unable to load readings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function sendCommand(command, payload = {}) {
    try {
      setSendingCommand(true);
      setStatusMessage('');
      const response = await fetch(`${API_BASE_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: DEVICE_ID,
          command,
          ...payload,
        }),
      });

      if (!response.ok) throw new Error(`Command failed with ${response.status}`);
      setStatusMessage(`${command} command sent`);
    } catch (error) {
      setStatusMessage(error.message || 'Unable to send command');
    } finally {
      setSendingCommand(false);
    }
  }

  async function subscribeToAlerts() {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter an email address to subscribe to unsafe-room alerts.');
      return;
    }

    try {
      setStatusMessage('');
      const response = await fetch(`${API_BASE_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || `Subscribe failed with ${response.status}`);
      setStatusMessage(data.message || 'Subscription email sent. Confirm it from your inbox.');
      setEmail('');
    } catch (error) {
      setStatusMessage(error.message || 'Unable to subscribe to alerts');
    }
  }

  useEffect(() => {
    fetchReadings();
    const timer = setInterval(fetchReadings, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const sortedReadings = useMemo(() => readings.slice(0, 10), [readings]);
  const statusText = latest?.alertMessage || 'Waiting for readings';
  const roomSafe = latest && !latest.alert;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>SMART BABY ROOM MONITOR</Text>
            <Text style={styles.subtitle}>Mobile caregiver dashboard</Text>
          </View>

          <View style={[styles.statusCard, roomSafe ? styles.statusSafe : styles.statusAlert]}>
            <View style={styles.statusIcon}>
              <Text style={styles.statusIconText}>{roomSafe ? 'OK' : '!'}</Text>
            </View>
            <View style={styles.statusTextBlock}>
              <Text style={styles.statusEyebrow}>Current room status</Text>
              <Text style={styles.statusTitle}>{statusText}</Text>
              <Text style={styles.statusMeta}>
                Last reading: {latest ? formatTime(latest.timestamp) : 'waiting for data'}
              </Text>
              {lastRefresh && <Text style={styles.statusMeta}>Dashboard refreshed {lastRefresh.toLocaleTimeString()}</Text>}
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#6c3f1f" />
              <Text style={styles.loadingText}>Loading monitor data...</Text>
            </View>
          ) : (
            <>
              <View style={styles.metricsGrid}>
                <MetricCard
                  label="Temperature"
                  value={latest ? `${latest.temperature.toFixed(1)} C` : '--'}
                  detail={latest?.fanOn ? 'Fan active' : latest?.heaterOn ? 'Heater active' : 'Climate idle'}
                  alert={latest?.fanOn || latest?.heaterOn}
                />
                <MetricCard
                  label="Humidity"
                  value={latest ? `${latest.humidity.toFixed(0)}%` : '--'}
                  detail="Comfort reading"
                />
                <MetricCard
                  label="Noise"
                  value={latest ? latest.noiseValue : '--'}
                  detail={latest?.crying ? 'Crying detected' : 'Quiet'}
                  alert={latest?.crying}
                />
                <MetricCard
                  label="Safe Area"
                  value={latest?.safeZone || '--'}
                  detail={latest ? `${latest.distanceCm.toFixed(0)} cm` : 'No distance reading'}
                  alert={latest?.safeZone === 'ALERT'}
                />
                <MetricCard
                  label="Night Light"
                  value={latest?.lightStatus || '--'}
                  detail={latest?.lightStatus === 'Dark' ? 'Light active' : 'Automatic mode'}
                />
                <MetricCard
                  label="Crib"
                  value={latest?.cribRocking ? 'Rocking' : 'Idle'}
                  detail={latest?.motion ? 'Motion detected' : 'No motion'}
                />
                <MetricCard label="Fan" value={latest?.fanOn ? 'On' : 'Off'} detail="Cooling actuator" />
                <MetricCard label="Heater" value={latest?.heaterOn ? 'On' : 'Off'} detail="Heating actuator" />
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Remote Controls</Text>
                  <Pressable style={styles.refreshMiniButton} onPress={fetchReadings} disabled={refreshing}>
                    <Text style={styles.refreshMiniText}>{refreshing ? 'Refreshing' : 'Refresh'}</Text>
                  </Pressable>
                </View>
                <View style={styles.commandGrid}>
                  <CommandButton
                    label="Remote Reset"
                    detail="Restart"
                    danger
                    disabled={sendingCommand}
                    onPress={() => sendCommand('reboot')}
                  />
                  <CommandButton
                    label="Remote Heater"
                    detail={latest?.heaterOn ? 'Turn Off' : 'Turn On'}
                    disabled={sendingCommand}
                    onPress={() => sendCommand('heater', { enabled: !latest?.heaterOn })}
                  />
                  <CommandButton
                    label="Remote Fan"
                    detail={latest?.fanOn ? 'Turn Off' : 'Turn On'}
                    disabled={sendingCommand}
                    onPress={() => sendCommand('fan', { enabled: !latest?.fanOn })}
                  />
                  <CommandButton
                    label="Remote Crib"
                    detail={latest?.cribRocking ? 'Stop' : 'Rock'}
                    disabled={sendingCommand}
                    onPress={() => sendCommand('crib', { enabled: !latest?.cribRocking })}
                  />
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Email Alerts</Text>
                <View style={styles.subscribeRow}>
                  <TextInput
                    value={email}
                    style={styles.emailInput}
                    placeholder="parent@example.com"
                    placeholderTextColor="#8a735d"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={setEmail}
                  />
                  <Pressable style={styles.subscribeButton} onPress={subscribeToAlerts}>
                    <Text style={styles.subscribeButtonText}>Subscribe</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Temperature Trend</Text>
                <TemperatureTrend readings={sortedReadings} />
                <Text style={styles.sectionNote}>Last {sortedReadings.length} readings from DynamoDB</Text>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Recent Readings</Text>
                {sortedReadings.map((item) => (
                  <View key={`${item.deviceId}-${item.timestamp}`} style={styles.readingRow}>
                    <View>
                      <Text style={styles.readingStatus}>{item.alertMessage}</Text>
                      <Text style={styles.readingTime}>{formatTime(item.timestamp)}</Text>
                    </View>
                    <Text style={styles.readingValue}>{item.temperature.toFixed(1)} C</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {statusMessage ? <Text style={styles.feedback}>{statusMessage}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#d6a75f',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
    backgroundColor: '#d6a75f',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    color: '#24170f',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    color: '#5a3c25',
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    shadowColor: '#382212',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  statusSafe: {
    backgroundColor: '#fffaf0',
    borderColor: '#8f6a2f',
  },
  statusAlert: {
    backgroundColor: '#fff1e8',
    borderColor: '#9c4b2f',
  },
  statusIcon: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#6c3f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconText: {
    color: '#fffaf0',
    fontSize: 24,
    fontWeight: '900',
  },
  statusTextBlock: {
    flex: 1,
  },
  statusEyebrow: {
    color: '#765b3d',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statusTitle: {
    color: '#24170f',
    fontSize: 30,
    fontWeight: '900',
    marginVertical: 4,
  },
  statusMeta: {
    color: '#5a3c25',
    fontSize: 13,
  },
  loadingCard: {
    backgroundColor: '#fffaf0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#5a3c25',
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    width: '48%',
    minHeight: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(82, 50, 24, 0.24)',
    backgroundColor: '#fffaf0',
    padding: 12,
  },
  metricCardAlert: {
    backgroundColor: '#fff1e8',
    borderColor: '#9c4b2f',
  },
  metricLabel: {
    color: '#7a6148',
    fontSize: 13,
    fontWeight: '800',
  },
  metricValue: {
    color: '#24170f',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },
  metricDetail: {
    color: '#5a3c25',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(82, 50, 24, 0.24)',
    backgroundColor: '#fffaf0',
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#24170f',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  refreshMiniButton: {
    backgroundColor: '#f4dfb7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refreshMiniText: {
    color: '#5a3c25',
    fontWeight: '900',
  },
  commandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  commandButton: {
    width: '48%',
    minHeight: 82,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(103, 74, 43, 0.24)',
    backgroundColor: '#fff7ea',
    padding: 12,
    justifyContent: 'center',
  },
  commandDanger: {
    backgroundColor: '#ffe9dc',
    borderColor: '#9c4b2f',
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  commandLabel: {
    color: '#24170f',
    fontSize: 15,
    fontWeight: '900',
  },
  commandDangerText: {
    color: '#7d301f',
  },
  commandDetail: {
    color: '#7a6148',
    fontSize: 13,
    marginTop: 5,
    fontWeight: '700',
  },
  subscribeRow: {
    gap: 10,
  },
  emailInput: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(103, 74, 43, 0.28)',
    backgroundColor: '#fff7ea',
    paddingHorizontal: 12,
    color: '#24170f',
    fontSize: 15,
  },
  subscribeButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#6c3f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonText: {
    color: '#fffaf0',
    fontWeight: '900',
  },
  trendBars: {
    height: 138,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 10,
  },
  trendItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '80%',
    borderRadius: 8,
    backgroundColor: '#8c5f2d',
  },
  trendLabel: {
    color: '#7a6148',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 5,
  },
  sectionNote: {
    color: '#7a6148',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  readingRow: {
    minHeight: 54,
    borderTopWidth: 1,
    borderTopColor: '#eadac0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  readingStatus: {
    color: '#24170f',
    fontWeight: '900',
  },
  readingTime: {
    color: '#7a6148',
    fontSize: 12,
    marginTop: 2,
  },
  readingValue: {
    color: '#24170f',
    fontWeight: '900',
  },
  feedback: {
    color: '#24170f',
    backgroundColor: '#fffaf0',
    borderRadius: 10,
    padding: 12,
    overflow: 'hidden',
    fontWeight: '700',
  },
});
