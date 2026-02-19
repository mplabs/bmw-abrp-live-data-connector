# BMW -> ABRP Live Data Connector

A Bun-based service that streams BMW CarData MQTT (and optionally polls BMW CarData REST), normalizes the telemetry, and forwards it to the ABRP Telemetry API.

## Features
- Streams BMW CarData MQTT in near real time
- Supports mirrored BMW MQTT data from a custom broker (for example via `bmw-mqtt-bridge`)
- Optionally polls BMW CarData REST for telematic data
- Extracts telemetry (SoC, charging state, location, speed, power, etc.) using configurable JSON-path mappings
- Sends telemetry to ABRP with built-in rate limiting
- Includes BMW OAuth device-code helper

## Requirements
- Docker + Docker Compose
- Either direct BMW CarData Streaming setup, or a mirrored MQTT feed containing BMW raw payloads
- ABRP API key + user token

Optional (for local development):
- Bun (runtime)

## Setup (myBMW CarData Streaming)
1) Create a BMW CarData client and subscribe it to **CarData** in the myBMW portal: https://www.bmw.de/de-de/mybmw/mapped-vehicle/public/car-data-info/
2) Choose the telematic keys you want to stream (minimum set for ABRP):
   - `vehicle.drivetrain.batteryManagement.header` (SoC)
   - `vehicle.drivetrain.electricEngine.charging.status`
   - `vehicle.body.chargingPort.status`
   - `vehicle.cabin.infotainment.navigation.currentLocation.latitude`
   - `vehicle.cabin.infotainment.navigation.currentLocation.longitude`
   - `vehicle.vehicle.avgSpeed`
   - `vehicle.powertrain.electric.battery.charging.power`
   - `vehicle.drivetrain.electricEngine.charging.timeRemaining`
3) Copy the **Client ID** from the portal (used for the device-code flow).
4) Copy the portal credentials exactly as shown:
   - **Host** → `mqtt.host`
   - **Port** → `mqtt.port`
   - **Benutzername** → `bmw.username`
   - **Topic** → `bmw.topic`
5) Pull the released Docker image:

```bash
docker pull mplabs/bmw-abrp-live-connector:latest
```

6) Create a real config file (an empty file will fail). Start from the example and fill in:
   - `bmw.clientId`, `bmw.username`, `bmw.topic`
   - `mqtt.host`, `mqtt.port`
   - (You can fill ABRP later, but the file must be valid YAML.)
   - Remove any old `bmw.tokensFile` entry; tokens are always stored at `/data/bmw.tokens.json`.

```bash
cp config.example.yaml config.yaml
```

7) Run the device-code flow to generate tokens (always stored at `/data/bmw.tokens.json`). Make sure your host folder or volume is mounted to `/data`.

```bash
docker run --rm -it \
  -v "$PWD/config.yaml:/config.yaml:ro" \
  -v bmw-abrp-live-connector-data:/data \
  -e CONFIG_PATH=/config.yaml \
  mplabs/bmw-abrp-live-connector bun run src/cli/device-code.ts
```

Hint: This connector only works if **CarData** access is enabled for your client in the myBMW portal.

8) Add ABRP credentials in `config.yaml`:
   - `abrp.apiKey`, `abrp.userToken`
9) Start the connector with Docker:

```bash
docker compose up -d
```

Optional (REST polling):
- Set `bmwRest.enabled: true`
- Set `bmwRest.technicalDescriptors` to the keys you want (same list as step 2)

References:
- https://www.bmw.de/de-de/mybmw/mapped-vehicle/public/car-data-info/
- https://bmw-cardata.bmwgroup.com/customer/public/api-documentation/Id-Streaming
- https://bmw-cardata.bmwgroup.com/customer/public/api-specification
- https://documenter.getpostman.com/view/7396339/SWTK5a8w

## Setup (mirrored MQTT broker)
If you mirror BMW payloads to another broker (for example with https://dj0abr.github.io/bmw-mqtt-bridge/), configure MQTT like this:

```yaml
mqtt:
  source: "mirror"
  host: "<MIRROR_BROKER_HOST>"
  port: 1883
  tls: false
  topicPrefix: "bmw/"
  # username: "optional"
  # password: "optional"
```

The connector subscribes to `<topicPrefix>raw/<bmw.topic>/#` and expects the raw BMW JSON payload on those topics.

## Docker (VPS deployment)
Run with docker-compose (recommended):

```bash
cp config.example.yaml config.yaml
docker compose up -d
```

Run directly with docker:

```bash
docker run --rm \
  -v "$PWD/config.yaml:/config.yaml:ro" \
  -v bmw-abrp-live-connector-data:/data \
  -e CONFIG_PATH=/config.yaml \
  mplabs/bmw-abrp-live-connector
```

## Local development (optional)
If you want to run without Docker:

```bash
bun install
bun run device-code
bun start
```

Note: `/data/bmw.tokens.json` is required when using direct BMW MQTT (`mqtt.source: bmw`) or BMW REST polling. Mirror-only MQTT mode does not require BMW tokens.

For live reload:

```bash
bun run dev
```

## Configuration
The app loads `config.yaml` by default. Override with `CONFIG_PATH=/path/to/config.yaml`.

### Values from the myBMW CarData portal
Use the myBMW portal to fill in these fields when `mqtt.source: bmw`:

- **Host** → `mqtt.host`
- **Port** → `mqtt.port`
- **Benutzername** → `bmw.username`
- **Topic** → `bmw.topic`

The REST API uses the **BMW access token** from `/data/bmw.tokens.json` (created by the device-code flow). The connector uses that automatically.

### `bmw`
- `clientId`: BMW app client id (required for device code flow)
- `username`: **Benutzername** from the myBMW portal (required when `mqtt.source: bmw`)
- `topic`: **Topic** from the myBMW portal
- `deviceCodeEndpoint` / `tokenEndpoint`: Override BMW OAuth endpoints if needed

### `abrp`
- `apiKey`: ABRP API key
- `userToken`: ABRP user token (used as `token` query param)

### `mqtt`
MQTT input configuration (direct BMW or mirrored source).

Example:

```yaml
mqtt:
  source: "bmw"
  enabled: true
  host: "customer.streaming-cardata.bmwgroup.com"
  port: 9000
  tls: true
  topicPrefix: "bmw/"
```

Fields:
- `source`: `bmw` (default) or `mirror`
- `enabled`: Turn streaming on/off (default: true)
- `host`: Broker host (myBMW Host for `bmw` mode)
- `port`: Broker port (myBMW Port for `bmw` mode)
- `tls`: Use TLS (`mqtts://`) when true (default: true)
- `topicPrefix`: Mirror base prefix (default: `bmw/`), used only in `mirror` mode
- `username`: Optional broker username override
- `password`: Optional broker password override
- `clientId`: Optional MQTT client id
- `keepaliveSeconds`: Keepalive interval (default: 60)

### `bmwRest`
BMW CarData REST polling configuration (disabled by default in `config.example.yaml`).

Example:

```yaml
bmwRest:
  enabled: true
  intervalSeconds: 300
  containerName: "abrp-live-connector"
  technicalDescriptors:
    - "vehicle.drivetrain.batteryManagement.header"
```

Fields:
- `enabled`: Turn polling on/off (default: false)
- `intervalSeconds`: Poll interval in seconds (default: 300)
- `baseUrl`: Override REST base URL (default: `https://api-cardata.bmwgroup.com`)
- `containerName`: Name to find/create
- `technicalDescriptors`: Keys to include when auto-creating a container

### `mapping`
Map ABRP telemetry fields to BMW **data keys** (the keys inside the `telematicData` map from the REST API). Each field can have multiple fallback keys.

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
- `elevation`
- `heading`
- `speed`
- `power`
- `charging_power`
- `remaining_charge_time`
- `remaining_range`
- `tire_pressure_fl`
- `tire_pressure_fr`
- `tire_pressure_rl`
- `tire_pressure_rr`
- `utc` (optional; current time used if omitted)

### `rateLimitSeconds`
Minimum seconds between ABRP telemetry pushes (default: 10).

### `logLevel`
Controls log verbosity (`debug`, `info`, `warn`, `error`). Default is `info`.

## Telemetry flow
BMW MQTT streaming and/or REST responses are merged into the latest snapshot. The connector sends a merged snapshot to ABRP whenever SoC is available (and the rate limit allows it).

## Device code flow notes
The device-code helper reads `config.yaml` and uses `bmw.clientId` with the required scope for CarData.

If the device-code response does not include a verification URL, open https://customer.bmwgroup.com/oneid/link and enter the displayed user code.

To run the device-code flow in Docker, use the command from the setup section above.

### Token refresh
When BMW auth is in use (`mqtt.source: bmw` or `bmwRest.enabled: true`), the connector refreshes tokens automatically using `/data/bmw.tokens.json`.

## Security
- `config.yaml` and `/data/bmw.tokens.json` are in `.gitignore` for a reason. Keep secrets out of git.
- Prefer using `config.example.yaml` as a template and store real credentials locally.
- Keep credentials only in `config.yaml` and the tokens file; do not inline tokens in code or scripts.

## Docs
- Functional spec: `BMW-Telemetry-to-ABRP-Live-Connector-FSD.md`

## Troubleshooting
- If no data is flowing in `bmw` mode, verify `bmw.username` and `bmw.topic`.
- If no data is flowing in `mirror` mode, verify `mqtt.topicPrefix` and that mirrored topics exist at `<topicPrefix>raw/<bmw.topic>/#`.
- If MQTT or REST says `Not authorized`, re-run the device-code flow to refresh tokens.
- If ABRP rejects data, confirm your API key + user token and check mapping field names.
- To inspect the ID token expiry/scopes, run `bun run debug:token`.
- Enable extra logging by inspecting the console output; all logs are structured JSON.
