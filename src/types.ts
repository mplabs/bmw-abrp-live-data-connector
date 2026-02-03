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
    username: string
    topic: string
    deviceCodeEndpoint?: string
    tokenEndpoint?: string
    tokens: BmwTokens
}

export type BmwRestConfig = {
    enabled: boolean
    intervalSeconds: number
    baseUrl: string
    containerName?: string
    technicalDescriptors?: string[]
}

export type MqttConfig = {
    brokerUrl: string
    enabled?: boolean
    tls?: boolean
    clientId?: string
    keepaliveSeconds?: number
}

export type AppConfig = {
    bmw: BmwConfig
    bmwRest: BmwRestConfig
    abrp: AbrpConfig
    mqtt: MqttConfig
    mapping: TelemetryMapping
    rateLimitSeconds?: number
    logLevel?: 'debug' | 'info' | 'warn' | 'error'
}
