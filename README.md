# SMART BABY ROOM MONITOR

Cloud-enabled IoT smart baby room monitoring system built for a Level 6 Computer Science IoT project.

The system monitors baby room safety and comfort using an ESP32 device simulated in Wokwi, AWS cloud services, a React web dashboard, and an Expo mobile app prototype.

## Project Overview

The project helps caregivers monitor baby room conditions in real time and receive alerts when unsafe conditions are detected. It also supports remote control of selected actuators from the web dashboard or mobile app.

The system monitors:

- Temperature
- Humidity
- Light level
- Motion
- Noise/crying simulation
- Safe-zone distance
- Fan status
- Heater status
- Crib-rocking status

## Core Features

- ESP32-based IoT device simulation in Wokwi
- Local OLED display for live room status
- LED and buzzer alerts for unsafe conditions
- Automatic fan activation when the room is too hot
- Automatic heater activation when the room is too cold
- Automatic night light activation when the room is dark
- Smart crib rocking when movement is detected and the room is safe
- AWS IoT Core MQTT communication
- DynamoDB storage for timestamped readings
- Lambda and API Gateway backend
- React web dashboard
- Expo mobile dashboard prototype
- Remote commands for reset, fan, heater, and crib
- SNS email alerts for unsafe room conditions

## Architecture

### Monitoring Flow

```text
ESP32 sensors
→ AWS IoT Core
→ IoT Rule
→ DynamoDB
→ Lambda
→ API Gateway
→ Web dashboard / Mobile app
```

### Remote Command Flow

```text
Web dashboard / Mobile app
→ API Gateway
→ Lambda
→ AWS IoT Core command topic
→ ESP32 subscribed command handler
→ Actuator response
```

### Alert Flow

```text
ESP32 unsafe reading
→ AWS IoT Core
→ IoT Rule
→ Lambda
→ Amazon SNS
→ Caregiver email alert
```

## AWS Services Used

- AWS IoT Core
- DynamoDB
- Lambda
- API Gateway
- Amazon SNS
- IAM roles and policies

## IoT Topics

Sensor readings:

```text
baby-monitor/readings
```

Remote commands:

```text
baby-monitor/commands/smart-baby-monitor-esp32
```

## Web Dashboard

The web dashboard is built with React and Vite.

Run locally:

```bash
npm install
npm run dev
```

Build for deployment:

```bash
npm run build
```

The deployable static files are generated in:

```text
dist/
```

## Mobile App

The mobile dashboard is built with React Native and Expo.

Run locally:

```bash
cd mobile
npm install
npx expo start --clear
```

Open the app using Expo Go.

## API Endpoints

The frontend uses API Gateway endpoints for:

- `GET /readings` - retrieves latest and recent readings
- `POST /command` - sends remote commands to ESP32
- `POST /subscribe` - subscribes caregiver email to SNS alerts

## Security Notes

Sensitive files must not be committed to GitHub.

Excluded secrets include:

- AWS private keys
- IoT device certificates
- `.pem`, `.key`, and `.crt` files
- environment files
- build output and dependency folders

The project uses:

- MQTT over TLS
- AWS IoT certificates
- IoT policies
- IAM roles
- SNS email confirmation

## Limitations

- The hardware device is simulated in Wokwi.
- Crying/noise is simulated using a potentiometer.
- Safe-zone detection is simulated using an ultrasonic sensor.
- The project is a prototype and is not a medical device.
- Email alerts may have delivery delays.

## Future Improvements

- Add user authentication with Amazon Cognito
- Add mobile push notifications
- Add historical analytics and longer-term charts
- Support multiple baby rooms/devices
- Replace simulated noise input with a real sound sensor
- Add physical hardware implementation

