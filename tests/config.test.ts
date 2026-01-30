import { describe, expect, it } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '../src/config'

const writeJson = async (filePath: string, data: unknown) => {
    await writeFile(filePath, JSON.stringify(data, null, 2))
}

const writeYaml = async (filePath: string, data: string) => {
    await writeFile(filePath, data)
}

describe('loadConfig', () => {
    it('loads tokens from tokensFile', async () => {
        const tempDir = path.join(tmpdir(), `abrp-test-${randomUUID()}`)
        await mkdir(tempDir, { recursive: true })

        const tokensPath = path.join(tempDir, 'bmw.tokens.json')
        await writeJson(tokensPath, {
            access: 'access-file',
            refresh: 'refresh-file',
            id: 'id-file',
        })

        const configPath = path.join(tempDir, 'config.yaml')
        await writeYaml(
            configPath,
            `bmw:
  clientId: "client-id"
  gcid: "gcid"
  vin: "vin"
  tokensFile: "bmw.tokens.json"
abrp:
  apiKey: "api"
  userToken: "user"
mqtt:
  brokerUrl: "mqtt://broker"
mapping:
  soc: ["vehicle.soc"]
`,
        )

        const config = await loadConfig(configPath)

        expect(config.bmw.tokens.access).toBe('access-file')
        expect(config.bmw.tokens.refresh).toBe('refresh-file')
        expect(config.bmw.tokens.id).toBe('id-file')

        await rm(tempDir, { recursive: true, force: true })
    })

    it('requires a tokensFile entry', async () => {
        const tempDir = path.join(tmpdir(), `abrp-test-${randomUUID()}`)
        await mkdir(tempDir, { recursive: true })

        const configPath = path.join(tempDir, 'config.yaml')
        await writeYaml(
            configPath,
            `bmw:
  clientId: "client-id"
  gcid: "gcid"
  vin: "vin"
abrp:
  apiKey: "api"
  userToken: "user"
mqtt:
  brokerUrl: "mqtt://broker"
mapping:
  soc: ["vehicle.soc"]
`,
        )

        await expect(loadConfig(configPath)).rejects.toThrow('bmw.tokensFile')

        await rm(tempDir, { recursive: true, force: true })
    })
})
