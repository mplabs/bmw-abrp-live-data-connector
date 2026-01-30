import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { extractTelemetry } from '../src/mapping'
import type { TelemetryMapping } from '../src/types'

const baseMapping: TelemetryMapping = {
    soc: ['vehicle.powertrain.electric.battery.stateOfCharge.target', 'fallback.soc'],
    is_charging: ['vehicle.drivetrain.electricEngine.charging.status'],
    is_plugged_in: ['vehicle.drivetrain.electricEngine.charging.plugConnectionState'],
    lat: ['location.latitude'],
    lon: ['location.longitude'],
    speed: ['vehicle.speed'],
    power: ['vehicle.powertrain.electric.power'],
    charging_power: ['vehicle.powertrain.electric.chargingPower'],
    remaining_charge_time: ['vehicle.powertrain.electric.remainingChargingTime'],
    utc: ['timestamp'],
}

describe('extractTelemetry', () => {
    const realNow = Date.now

    beforeEach(() => {
        Date.now = () => 1_700_000_000_000
    })

    afterEach(() => {
        Date.now = realNow
    })

    it('maps numeric and boolean fields from BMW data map keys', () => {
        const payload = {
            timestamp: '2026-01-30T08:09:11.594Z',
            data: {
                'vehicle.powertrain.electric.battery.stateOfCharge.target': {
                    value: 82.5,
                },
                'vehicle.drivetrain.electricEngine.charging.status': {
                    value: 'charging',
                },
                'vehicle.drivetrain.electricEngine.charging.plugConnectionState': {
                    value: 'yes',
                },
                'vehicle.powertrain.electric.chargingPower': {
                    value: '6.7',
                },
                'vehicle.powertrain.electric.remainingChargingTime': {
                    value: 42,
                },
                'vehicle.speed': { value: '88' },
                'vehicle.powertrain.electric.power': { value: 12.3 },
                'location.latitude': { value: 52.52 },
                'location.longitude': { value: 13.4 },
            },
        }

        const telemetry = extractTelemetry(payload, baseMapping)

        expect(telemetry).toEqual({
            utc: 1769760551,
            soc: 82.5,
            is_charging: true,
            is_plugged_in: true,
            power: 12.3,
            lat: 52.52,
            lon: 13.4,
            speed: 88,
            charging_power: 6.7,
            remaining_charge_time: 42,
        })
    })

    it('falls back to secondary keys and default utc when missing', () => {
        const payload = {
            data: {
                'fallback.soc': { value: '64' },
                'vehicle.drivetrain.electricEngine.charging.status': { value: 'idle' },
                'vehicle.drivetrain.electricEngine.charging.plugConnectionState': { value: 'no' },
            },
        }

        const telemetry = extractTelemetry(payload, baseMapping)

        expect(telemetry.utc).toBe(1_700_000_000)
        expect(telemetry.soc).toBe(64)
        expect(telemetry.is_charging).toBe(false)
        expect(telemetry.is_plugged_in).toBe(false)
    })

    it('reads top-level keys when no data entry exists', () => {
        const mapping: TelemetryMapping = {
            soc: ['soc'],
            utc: ['timestamp'],
        }
        const payload = {
            soc: 55,
            timestamp: '2026-01-30T08:09:11.594Z',
        }

        const telemetry = extractTelemetry(payload, mapping)

        expect(telemetry.soc).toBe(55)
        expect(telemetry.utc).toBe(1769760551)
    })
})
