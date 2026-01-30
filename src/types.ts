export type Telemetry = {
    utc: number
    soc?: number
    is_charging?: boolean
    is_plugged_in?: boolean
    power?: number
    lat?: number
    lon?: number
    speed?: number
    charging_power?: number
    remaining_charge_time?: number
}

export type TelemetryMapping = Record<string, string[]>

export type AbrpConfig = {
    apiKey: string
    userToken: string
}

export type BmwTokens = {
    access: string
    refresh: string
    id: string
}

export type BmwConfig = {
    clientId?: string
    gcid: string
    vin: string
    tokensFile?: string
    deviceCodeEndpoint?: string
    tokenEndpoint?: string
    tokens: BmwTokens
}

export type MqttConfig = {
    brokerUrl: string
    tls?: boolean
    clientId?: string
    keepaliveSeconds?: number
    username?: string
    password?: string
    passwordToken?: 'id' | 'access' | 'refresh'
}

export type AppConfig = {
    bmw: BmwConfig
    abrp: AbrpConfig
    mqtt: MqttConfig
    mapping: TelemetryMapping
    rateLimitSeconds?: number
}
