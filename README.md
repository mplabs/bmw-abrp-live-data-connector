# BMW -> ABRP Live Data Connector

A Bun-based service that listens to BMW CarData Streaming (MQTT), normalizes the telemetry, and forwards it to the ABRP Telemetry API.

## Features
- Subscribes to BMW MQTT topics for a vehicle VIN
- Extracts telemetry (SoC, charging state, location, speed, power, etc.) using configurable JSON-path mappings
- Sends telemetry to ABRP with built-in rate limiting
- Includes BMW OAuth device-code helper

## Requirements
- Bun (runtime)
- BMW CarData Streaming credentials (clientId, GCID, VIN, tokens)
- ABRP API key + user token

## Quick start
1) Install dependencies

```bash
bun install
```

2) Create a config

```bash
cp config.example.yaml config.yaml
```

3) Fill in `config.yaml` with your BMW + ABRP details

4) (Optional) Run the BMW device-code flow to get tokens

```bash
bun run device-code
```

This writes `bmw.tokens.json` in the repo root. Point `bmw.tokensFile` to it.

5) Start the connector

```bash
bun run start
```

For live reload during development:

```bash
bun run dev
```

## Configuration
The app loads `config.yaml` by default. Override with `CONFIG_PATH=/path/to/config.yaml`.

### Values from the myBMW CarData Streaming portal
Use the myBMW portal to fill in these fields:

- **Host** + **Port** → `mqtt.brokerUrl` (e.g. `mqtts://customer.streaming-cardata.bmwgroup.com:9000`)
- **Benutzername** → `bmw.gcid`
- **Topic** (VIN) → `bmw.vin`

The MQTT password is the **BMW ID token** from `bmw.tokens.json` (created by the device-code flow). The connector uses that automatically.

### `bmw`
- `clientId`: BMW app client id (required for device code flow)
- `gcid`: BMW GCID used as MQTT username
- `vin`: Vehicle VIN
- `tokensFile`: JSON file containing `access`, `refresh`, `id` tokens (recommended)
- `deviceCodeEndpoint` / `tokenEndpoint`: Override BMW OAuth endpoints if needed
- `tokens`: Inline access/refresh/id tokens (fallback; not recommended for long-term use)

### `abrp`
- `apiKey`: ABRP API key
- `userToken`: ABRP user token (used as `token` query param)

### `mqtt`
- `brokerUrl`: BMW MQTT broker URL (from BMW CarData Streaming portal; typically `mqtts://…:8883`)
- `tls`: Enable TLS (default: true)
- `clientId`: Optional custom client id
- `keepaliveSeconds`: Keepalive interval (default: 60)
- `username`: Optional override for MQTT username (default: `bmw.gcid`)
- `password`: Optional override for MQTT password
- `passwordToken`: Choose which BMW token to use as password when `mqtt.password` is not set (`id` | `access` | `refresh`, default: `id`)

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

The connector reads `payload.data[KEY].value` for each key. If a key isn’t in `data`, it will fall back to a top-level field with the same name (rare in BMW payloads).

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

## Device code flow notes
The device-code helper reads `config.yaml` and uses `bmw.clientId`. You can override the OAuth scope via `BMW_SCOPE` (default: `openid cardata cardata.streaming`).

### Token refresh
The connector refreshes BMW tokens automatically using the refresh token in `bmw.tokens.json`. It updates the tokens file and reconnects MQTT when a new ID token is issued, so you don’t need to re-run the device-code flow during normal operation.

## Security
- `config.yaml` and `bmw.tokens.json` are in `.gitignore` for a reason. Keep secrets out of git.
- Prefer using `config.example.yaml` as a template and store real credentials locally.
- Use `tokensFile` instead of inline tokens to avoid accidental secret exposure.

## Docs
- Functional spec: `BMW-Telemetry-to-ABRP-Live-Connector-FSD.md`

## Troubleshooting
- If MQTT connects but no data is flowing, verify `bmw.gcid` and `bmw.vin`.
- If MQTT says `Not authorized`, try setting `mqtt.passwordToken: "access"` in `config.yaml` and re-run the device-code flow to refresh tokens.
- If ABRP rejects data, confirm your API key + user token and check mapping field names.
- To inspect the ID token expiry/scopes, run `bun run debug:token`.
- Enable extra logging by inspecting the console output; all logs are structured JSON.
