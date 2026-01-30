import type { Telemetry, TelemetryMapping } from './types'

const getMetricValue = (payload: unknown, key: string): unknown => {
    if (!payload || typeof payload !== 'object') {
        return undefined
    }
    const root = payload as Record<string, unknown>
    const data = root.data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const entry = (data as Record<string, unknown>)[key]
        if (entry !== undefined && entry !== null) {
            if (entry && typeof entry === 'object' && 'value' in entry) {
                return (entry as Record<string, unknown>).value
            }
            return entry
        }
    }
    if (key in root) {
        return root[key]
    }
    return undefined
}

const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : undefined
    }
    return undefined
}

const toUnixSeconds = (value: unknown): number | undefined => {
    const numeric = toNumber(value)
    if (numeric !== undefined) {
        return numeric
    }
    if (typeof value === 'string') {
        const parsed = Date.parse(value)
        if (Number.isFinite(parsed)) {
            return Math.floor(parsed / 1000)
        }
    }
    return undefined
}

const toBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value === 'number') {
        return value !== 0
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['true', '1', 'yes', 'on', 'charging', 'plugged'].includes(normalized)) {
            return true
        }
        if (['false', '0', 'no', 'off', 'idle', 'unplugged'].includes(normalized)) {
            return false
        }
    }
    return undefined
}

const pickFirstValue = (payload: unknown, keys: string[] | undefined): unknown => {
    if (!keys || keys.length === 0) {
        return undefined
    }
    for (const key of keys) {
        const value = getMetricValue(payload, key)
        if (value !== undefined && value !== null) {
            return value
        }
    }
    return undefined
}

export const extractTelemetry = (payload: unknown, mapping: TelemetryMapping): Telemetry => {
    const nowUtc = Math.floor(Date.now() / 1000)

    const rawUtc = pickFirstValue(payload, mapping.utc)
    const utc = toUnixSeconds(rawUtc) ?? nowUtc

    const telemetry: Telemetry = { utc }

    const soc = toNumber(pickFirstValue(payload, mapping.soc))
    if (soc !== undefined) telemetry.soc = soc

    const isCharging = toBoolean(pickFirstValue(payload, mapping.is_charging))
    if (isCharging !== undefined) telemetry.is_charging = isCharging

    const isPlugged = toBoolean(pickFirstValue(payload, mapping.is_plugged_in))
    if (isPlugged !== undefined) telemetry.is_plugged_in = isPlugged

    const power = toNumber(pickFirstValue(payload, mapping.power))
    if (power !== undefined) telemetry.power = power

    const lat = toNumber(pickFirstValue(payload, mapping.lat))
    if (lat !== undefined) telemetry.lat = lat

    const lon = toNumber(pickFirstValue(payload, mapping.lon))
    if (lon !== undefined) telemetry.lon = lon

    const speed = toNumber(pickFirstValue(payload, mapping.speed))
    if (speed !== undefined) telemetry.speed = speed

    const chargingPower = toNumber(pickFirstValue(payload, mapping.charging_power))
    if (chargingPower !== undefined) telemetry.charging_power = chargingPower

    const remainingChargeTime = toNumber(pickFirstValue(payload, mapping.remaining_charge_time))
    if (remainingChargeTime !== undefined) telemetry.remaining_charge_time = remainingChargeTime

    return telemetry
}
