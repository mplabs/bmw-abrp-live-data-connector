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

### `mapping`
Map ABRP telemetry fields to JSON paths in the BMW payload. Each field can have multiple fallback paths.

Example:

```yaml
mapping:
  soc:
    - "vehicle.powertrain.electric.battery.stateOfCharge.target"
  is_charging:
    - "vehicle.drivetrain.electricEngine.charging.status"
```

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

## Device code flow notes
The device-code helper reads `config.yaml` and uses `bmw.clientId`. You can override the OAuth scope via `BMW_SCOPE` (default: `openid cardata cardata.streaming`).

## Security
- `config.yaml` and `bmw.tokens.json` are in `.gitignore` for a reason. Keep secrets out of git.
- Prefer using `config.example.yaml` as a template and store real credentials locally.
- Use `tokensFile` instead of inline tokens to avoid accidental secret exposure.

## Docs
- Functional spec: `BMW-Telemetry-to-ABRP-Live-Connector-FSD.md`

## Troubleshooting
- If MQTT connects but no data is flowing, verify `bmw.gcid` and `bmw.vin`.
- If ABRP rejects data, confirm your API key + user token and check mapping field names.
- Enable extra logging by inspecting the console output; all logs are structured JSON.
