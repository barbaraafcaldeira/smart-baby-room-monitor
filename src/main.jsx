import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  Bell,
  Cloud,
  Fan,
  Gauge,
  Heater,
  Moon,
  Power,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  ThumbsUp,
  Volume2,
  Waves,
} from 'lucide-react';
import './styles.css';

const API_URL = 'https://brq754wbx0.execute-api.eu-west-2.amazonaws.com/readings';
const COMMAND_API_URL = 'https://brq754wbx0.execute-api.eu-west-2.amazonaws.com/command';
const SUBSCRIBE_API_URL = 'https://brq754wbx0.execute-api.eu-west-2.amazonaws.com/subscribe';
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

function StatusPill({ active, label }) {
  return <span className={active ? 'pill pill-alert' : 'pill pill-ok'}>{label}</span>;
}

function Metric({ icon: Icon, label, value, detail, tone = 'neutral' }) {
  return (
    <section className={`metric metric-${tone}`}>
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function ActionButton({ icon: Icon, title, state, disabled, onClick, danger = false }) {
  return (
    <button className={danger ? 'action-button action-danger' : 'action-button'} disabled={disabled} onClick={onClick}>
      <Icon size={18} />
      <span>{title}</span>
      {state && <strong>{state}</strong>}
    </button>
  );
}

function MiniChart({ readings }) {
  const points = readings
    .slice()
    .reverse()
    .map((item) => asNumber(item.temperature));

  const max = Math.max(...points, 30);
  const min = Math.min(...points, 15);
  const range = Math.max(max - min, 1);

  const polyline = points
    .map((value, index) => {
      const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 42 - ((value - min) / range) * 36;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="mini-chart" viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="42" x2="100" y2="42" />
      <polyline points={polyline} />
    </svg>
  );
}

function Dashboard() {
  const [latest, setLatest] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [commandStatus, setCommandStatus] = useState('');
  const [sendingCommand, setSendingCommand] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  async function fetchReadings() {
    try {
      setError('');
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      const parsedLatest = normaliseReading(data.latest);
      const parsedReadings = (data.readings || []).map(normaliseReading).filter(Boolean);

      setLatest(parsedLatest);
      setReadings(parsedReadings);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Unable to load readings');
    } finally {
      setLoading(false);
    }
  }

  async function sendCommand(command, payload = {}) {
    try {
      setSendingCommand(true);
      setCommandStatus('');

      const response = await fetch(COMMAND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: DEVICE_ID,
          command,
          ...payload,
        }),
      });

      if (!response.ok) throw new Error(`Command failed with ${response.status}`);

      setCommandStatus(`${command} command sent`);
    } catch (err) {
      setCommandStatus(err.message || 'Unable to send command');
    } finally {
      setSendingCommand(false);
    }
  }

  async function subscribeToAlerts(event) {
    event.preventDefault();

    try {
      setSubscribing(true);
      setSubscribeStatus('');

      const response = await fetch(SUBSCRIBE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: alertEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || `Subscription failed with ${response.status}`);

      setSubscribeStatus(data.message || 'Subscription request sent. Check your email to confirm.');
      setAlertEmail('');
    } catch (err) {
      setSubscribeStatus(err.message || 'Unable to subscribe to alerts');
    } finally {
      setSubscribing(false);
    }
  }

  useEffect(() => {
    fetchReadings();
    const timer = setInterval(fetchReadings, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const statusTone = latest?.alert ? 'danger' : 'safe';
  const statusText = latest?.alertMessage || 'Waiting for readings';
  const StatusIcon = latest?.alert ? AlertTriangle : ThumbsUp;
  const sortedReadings = useMemo(() => readings.slice(0, 10), [readings]);

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <h1>SMART BABY ROOM MONITOR</h1>
          <p>Caregiver dashboard</p>
        </div>
        <button className="refresh-button" onClick={fetchReadings} disabled={loading}>
          <RefreshCw size={18} />
          Refresh
        </button>
      </header>

      <section className={`status-hero status-${statusTone}`}>
        <div className="baby-theme-mark" aria-hidden="true">
          <StatusIcon size={32} />
        </div>
        <div>
          <span className="eyebrow">Current Room Status</span>
          <h2>{statusText}</h2>
          <p>
            Last reading: {latest ? formatTime(latest.timestamp) : 'waiting for data'}
            {lastRefresh ? ` · Refreshed ${lastRefresh.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <div className="status-actions">
          <StatusPill active={latest?.alert} label={latest?.alert ? 'Attention Needed' : 'Room Safe'} />
          <StatusPill active={latest?.buzzerSilenced} label={latest?.buzzerSilenced ? 'Buzzer Silenced' : 'Buzzer Ready'} />
        </div>
      </section>

      {error && (
        <section className="error-band">
          <AlertTriangle size={18} />
          {error}
        </section>
      )}

      <section className="metrics-grid data-grid">
        <Metric
          icon={Thermometer}
          label="Temperature"
          value={latest ? `${latest.temperature.toFixed(1)}°C` : '--'}
          detail={latest?.fanOn ? 'Fan active' : latest?.heaterOn ? 'Heater active' : 'Climate idle'}
          tone={latest?.fanOn || latest?.heaterOn ? 'warning' : 'neutral'}
        />
        <Metric
          icon={Waves}
          label="Humidity"
          value={latest ? `${latest.humidity.toFixed(0)}%` : '--'}
          detail="Comfort reading"
        />
        <Metric
          icon={Volume2}
          label="Noise Level"
          value={latest ? latest.noiseValue : '--'}
          detail={latest?.crying ? 'Crying detected' : 'Quiet'}
          tone={latest?.crying ? 'danger' : 'neutral'}
        />
        <Metric
          icon={ShieldCheck}
          label="Safe Area"
          value={latest?.safeZone || '--'}
          detail={latest ? `${latest.distanceCm.toFixed(0)} cm from sensor` : 'No reading'}
          tone={latest?.safeZone === 'ALERT' ? 'danger' : 'neutral'}
        />
        <Metric
          icon={Moon}
          label="Night Light"
          value={latest?.lightStatus || '--'}
          detail={latest?.lightStatus === 'Dark' ? 'Light active' : 'Automatic mode'}
          tone={latest?.lightStatus === 'Dark' ? 'info' : 'neutral'}
        />
        <Metric
          icon={Gauge}
          label="Crib"
          value={latest?.cribRocking ? 'Rocking' : 'Idle'}
          detail={latest?.motion ? 'Motion detected' : 'No motion'}
          tone={latest?.cribRocking ? 'info' : 'neutral'}
        />
        <Metric
          icon={Fan}
          label="Fan"
          value={latest?.fanOn ? 'On' : 'Off'}
          detail="Cooling actuator"
          tone={latest?.fanOn ? 'warning' : 'neutral'}
        />
        <Metric
          icon={Heater}
          label="Heater"
          value={latest?.heaterOn ? 'On' : 'Off'}
          detail="Heating actuator"
          tone={latest?.heaterOn ? 'warning' : 'neutral'}
        />
      </section>

      <section className="dashboard-grid">
        <section className="panel controls-panel">
          <div className="panel-heading">
            <h3>Remote Controls</h3>
            <Cloud size={18} />
          </div>
          <div className="actions-grid">
            <ActionButton
              icon={Power}
              title="Remote Reset"
              state="Restart"
              disabled={sendingCommand}
              danger
              onClick={() => sendCommand('reboot')}
            />
            <ActionButton
              icon={Heater}
              title="Remote Heater"
              state={latest?.heaterOn ? 'Turn Off' : 'Turn On'}
              disabled={sendingCommand}
              onClick={() => sendCommand('heater', { enabled: !latest?.heaterOn })}
            />
            <ActionButton
              icon={Fan}
              title="Remote Fan"
              state={latest?.fanOn ? 'Turn Off' : 'Turn On'}
              disabled={sendingCommand}
              onClick={() => sendCommand('fan', { enabled: !latest?.fanOn })}
            />
            <ActionButton
              icon={Gauge}
              title="Remote Crib"
              state={latest?.cribRocking ? 'Stop' : 'Rock'}
              disabled={sendingCommand}
              onClick={() => sendCommand('crib', { enabled: !latest?.cribRocking })}
            />
          </div>
          {commandStatus && <p className="command-status">{commandStatus}</p>}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Temperature Trend</h3>
            <Thermometer size={18} />
          </div>
          <MiniChart readings={sortedReadings} />
          <p className="chart-note">Last {sortedReadings.length || 0} readings</p>
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h3>Live Signals</h3>
          <Bell size={18} />
        </div>
        <div className="signal-list compact-signals">
          <div>
            <Activity size={18} />
            <span>Motion</span>
            <strong>{latest?.motion ? 'Detected' : 'None'}</strong>
          </div>
          <div>
            <Volume2 size={18} />
            <span>Crying / Noise</span>
            <strong>{latest?.crying ? 'Detected' : 'Quiet'}</strong>
          </div>
          <div>
            <Bell size={18} />
            <span>Alert Buzzer</span>
            <strong>{latest?.buzzerSilenced ? 'Silenced' : latest?.alert ? 'Active' : 'Ready'}</strong>
          </div>
          <div>
            <Cloud size={18} />
            <span>Cloud</span>
            <strong>{latest ? 'Connected' : 'Waiting'}</strong>
          </div>
        </div>
      </section>

      <section className="panel subscription-panel">
        <div className="panel-heading">
          <h3>Email Alerts</h3>
          <AlertTriangle size={18} />
        </div>
        <form className="subscribe-form" onSubmit={subscribeToAlerts}>
          <input
            type="email"
            value={alertEmail}
            placeholder="parent@example.com"
            required
            onChange={(event) => setAlertEmail(event.target.value)}
          />
          <button className="subscribe-button" type="submit" disabled={subscribing}>
            {subscribing ? 'Sending...' : 'Subscribe'}
          </button>
        </form>
        {subscribeStatus && <p className="command-status">{subscribeStatus}</p>}
      </section>

      <section className="history">
        <div className="panel-heading">
          <h3>Recent Readings</h3>
          <span>{loading ? 'Loading...' : `${sortedReadings.length} records`}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Status</th>
                <th>Temp</th>
                <th>Humidity</th>
                <th>Distance</th>
                <th>Noise</th>
              </tr>
            </thead>
            <tbody>
              {sortedReadings.map((item) => (
                <tr key={`${item.deviceId}-${item.timestamp}`}>
                  <td>{formatTime(item.timestamp)}</td>
                  <td>{item.alertMessage}</td>
                  <td>{item.temperature.toFixed(1)}°C</td>
                  <td>{item.humidity.toFixed(0)}%</td>
                  <td>{item.distanceCm.toFixed(0)} cm</td>
                  <td>{item.crying ? 'High' : 'OK'}</td>
                </tr>
              ))}
              {!sortedReadings.length && (
                <tr>
                  <td colSpan="6">No readings available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Dashboard />);
