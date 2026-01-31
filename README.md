# BMW -> ABRP Live Data Connector

A Bun-based service that listens to BMW CarData Streaming (MQTT), normalizes the telemetry, and forwards it to the ABRP Telemetry API.

## Features
- Subscribes to BMW MQTT topics for a vehicle VIN
- Extracts telemetry (SoC, charging state, location, speed, power, etc.) using configurable JSON-path mappings
- Sends telemetry to ABRP with built-in rate limiting
- Includes BMW OAuth device-code helper

## Requirements
- Docker + Docker Compose
- BMW CarData Streaming setup (clientId + stream credentials from the myBMW portal: Host, Port, Topic, Benutzername)
- ABRP API key + user token

Optional (for local development):
- Bun (runtime)

## Setup (myBMW CarData Streaming)
1) Create a BMW CarData client and subscribe it to **CarData Streaming** in the myBMW portal: https://www.bmw.de/de-de/mybmw/mapped-vehicle/public/car-data-info/
2) Configure a stream and select these attributes (minimum set for ABRP):
   - `vehicle.drivetrain.batteryManagement.header` (SoC)
   - `vehicle.drivetrain.electricEngine.charging.status`
   - `vehicle.body.chargingPort.status`
   - `vehicle.cabin.infotainment.navigation.currentLocation.latitude`
   - `vehicle.cabin.infotainment.navigation.currentLocation.longitude`
   - `vehicle.vehicle.avgSpeed`
   - `vehicle.powertrain.electric.battery.charging.power`
   - `vehicle.drivetrain.electricEngine.charging.timeRemaining`
3) Copy the **Client ID** from the portal and run the **device‑code flow** (user code authorization) to generate tokens.
4) Copy the stream credentials exactly as shown in the portal:
   - **Host** + **Port** → `mqtt.host` and `mqtt.port`
   - **Benutzername** → `bmw.username`
   - **Topic** → `bmw.topic`
5) Build the Docker image (needed for the device-code flow):

```bash
docker build -t mplabs/bmw-abrp-live-connector .
```

6) Create the data directory (for tokens):

```bash
mkdir -p data
```

7) Create a real config file (an empty file will fail). Start from the example and fill in:
   - `bmw.clientId`, `bmw.username`, `bmw.topic`
   - `mqtt.host`, `mqtt.port`
   - `bmw.tokensFile: "/data/bmw.tokens.json"`
   - (You can fill ABRP later, but the file must be valid YAML.)

```bash
cp config.example.yaml config.yaml
```

8) Create the tokens file placeholder (Docker needs the file to exist):

```bash
touch data/bmw.tokens.json
```

9) Run the device-code flow to generate tokens

```bash
docker run --rm -it \\
  -v $(pwd)/config.yaml:/config.yaml:ro \\
  -v $(pwd)/data:/data \\
  -e CONFIG_PATH=/config.yaml \\
  mplabs/bmw-abrp-live-connector bun run src/cli/device-code.ts
```

Hint: This connector only works if **CarData Streaming** is enabled for your client in the myBMW portal.

10) Add ABRP credentials in `config.yaml` and confirm `bmw.tokensFile` points to `/data/bmw.tokens.json`:
   - `abrp.apiKey`, `abrp.userToken`
11) Start the connector with Docker:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
```

References:
- https://www.bmw.de/de-de/mybmw/mapped-vehicle/public/car-data-info/
- https://bmw-cardata.bmwgroup.com/customer/public/api-documentation/Id-Streaming
- https://bmw-cardata.bmwgroup.com/customer/public/api-specification
- https://documenter.getpostman.com/view/7396339/SWTK5a8w

## Docker (VPS deployment)
Run with docker-compose (recommended):

```bash
mkdir -p data
cp config.example.yaml config.yaml
touch data/bmw.tokens.json
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
```

Run directly with docker:

```bash
docker build -t mplabs/bmw-abrp-live-connector .
docker run --rm \\
  -v $(pwd)/config.yaml:/config.yaml:ro \\
  -v $(pwd)/data:/data \\
  -e CONFIG_PATH=/config.yaml \\
  mplabs/bmw-abrp-live-connector
```

## Local development (optional)
If you want to run without Docker:

```bash
bun install
bun run device-code
bun start
```

For live reload:

```bash
bun run dev
```

## Configuration
The app loads `config.yaml` by default. Override with `CONFIG_PATH=/path/to/config.yaml`.

### Values from the myBMW CarData Streaming portal
Use the myBMW portal to fill in these fields:

- **Host** → `mqtt.host`
- **Port** → `mqtt.port`
- **Benutzername** → `bmw.username`
- **Topic** → `bmw.topic`

The MQTT password is the **BMW ID token** from `bmw.tokens.json` (created by the device-code flow). The connector uses that automatically.

### `bmw`
- `clientId`: BMW app client id (required for device code flow)
- `username`: **Benutzername** from the myBMW portal
- `topic`: **Topic** from the myBMW portal
- `tokensFile`: JSON file containing `access`, `refresh`, `id` tokens (required)
- `deviceCodeEndpoint` / `tokenEndpoint`: Override BMW OAuth endpoints if needed

### `abrp`
- `apiKey`: ABRP API key
- `userToken`: ABRP user token (used as `token` query param)

### `mqtt`
- `host`: **Host** from the myBMW portal
- `port`: **Port** from the myBMW portal
- `tls`: Enable TLS (default: true)
- `clientId`: Optional custom client id
- `keepaliveSeconds`: Keepalive interval (default: 60)

### `mapping`
Map ABRP telemetry fields to BMW **data keys** (the keys inside the `data` map from the stream). Each field can have multiple fallback keys.

Example:

```yaml
mapping:
  soc:
    - "vehicle.drivetrain.batteryManagement.header"
  is_charging:
    - "vehicle.drivetrain.electricEngine.charging.status"
```

The connector reads `payload.data[KEY].value` for each key.

Supported telemetry fields include:
- `soc`
- `is_charging`
- `is_plugged_in`
- `lat`
- `lon`
- `speed`
- `power`
- `charging_power`
- `remaining_charge_time`
- `utc` (optional; current time used if omitted)

### `rateLimitSeconds`
Minimum seconds between ABRP telemetry pushes (default: 10).

### `logLevel`
Controls log verbosity (`debug`, `info`, `warn`, `error`). Default is `info`.

## Telemetry flow
BMW streaming messages are event-based and typically carry a single key update. The connector keeps the latest values it has seen and sends a merged snapshot to ABRP whenever SoC is available (and the rate limit allows it).

## Device code flow notes
The device-code helper reads `config.yaml` and uses `bmw.clientId`. You can override the OAuth scope via `BMW_SCOPE` (default: `openid cardata cardata.streaming`).

If the device-code response does not include a verification URL, open https://customer.bmwgroup.com/oneid/link and enter the displayed user code.

To run the device-code flow in Docker, use the command from the setup section above.

### Token refresh
The connector refreshes BMW tokens automatically using the refresh token in `bmw.tokens.json`. It updates the tokens file and reconnects MQTT when a new ID token is issued, so you don’t need to re-run the device-code flow during normal operation.

## Security
- `config.yaml` and `bmw.tokens.json` are in `.gitignore` for a reason. Keep secrets out of git.
- Prefer using `config.example.yaml` as a template and store real credentials locally.
- Use `tokensFile` instead of inline tokens to avoid accidental secret exposure.

## Docs
- Functional spec: `BMW-Telemetry-to-ABRP-Live-Connector-FSD.md`

## Troubleshooting
- If MQTT connects but no data is flowing, verify `bmw.username` and `bmw.topic`.
- If MQTT says `Not authorized`, re-run the device-code flow to refresh tokens.
- If ABRP rejects data, confirm your API key + user token and check mapping field names.
- To inspect the ID token expiry/scopes, run `bun run debug:token`.
- Enable extra logging by inspecting the console output; all logs are structured JSON.
