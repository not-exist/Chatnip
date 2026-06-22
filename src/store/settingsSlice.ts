import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { SettingsState, ModelInfo } from '@/types'
import { saveAppState } from '@/api/appState'

const defaultNapcatConfig = {
  host: '127.0.0.1',
  port: 3000,
  token: '',
}

const defaultOpencodeConfig = {
  host: '127.0.0.1',
  port: 4096,
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v)
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string')
}

function isModelInfo(v: unknown): v is ModelInfo | undefined {
  if (v === undefined || v === null) return true
  if (typeof v !== 'object' || v === null) return false
  const m = v as Record<string, unknown>
  return isString(m.providerID) && m.providerID.length > 0
    && isString(m.modelID) && m.modelID.length > 0
    && isString(m.name) && m.name.length > 0
}

function sanitizeSettings(raw: unknown): SettingsState {
  const defaults: SettingsState = {
    napcat: { ...defaultNapcatConfig },
    opencode: { ...defaultOpencodeConfig },
    defaultMessageCount: 200,
    defaultFeatures: ['summary', 'topics', 'sentiment'],
    defaultModel: undefined,
  }

  if (typeof raw !== 'object' || raw === null) return defaults
  const src = raw as Record<string, unknown>

  // napcat validation
  if (typeof src.napcat === 'object' && src.napcat !== null) {
    const n = src.napcat as Record<string, unknown>
    if (isString(n.host)) defaults.napcat.host = n.host
    if (isNumber(n.port)) defaults.napcat.port = n.port
    if (isString(n.token)) defaults.napcat.token = n.token
  }

  // opencode validation
  if (typeof src.opencode === 'object' && src.opencode !== null) {
    const o = src.opencode as Record<string, unknown>
    if (isString(o.host)) defaults.opencode.host = o.host
    if (isNumber(o.port)) defaults.opencode.port = o.port
  }

  // defaultMessageCount validation
  if (isNumber(src.defaultMessageCount) && (src.defaultMessageCount as number) > 0) {
    defaults.defaultMessageCount = src.defaultMessageCount as number
  }

  // defaultFeatures validation
  if (isStringArray(src.defaultFeatures)) {
    defaults.defaultFeatures = src.defaultFeatures as string[]
  }

  // defaultModel validation — must have non-empty providerID, modelID, and name
  if (isModelInfo(src.defaultModel)) {
    defaults.defaultModel = src.defaultModel as ModelInfo | undefined
  }

  return defaults
}

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem('chatnip-settings')
    if (raw) {
      return sanitizeSettings(JSON.parse(raw))
    }
  } catch { /* ignore corrupt JSON */ }
  return sanitizeSettings(null)
}

const initialState: SettingsState = loadSettings()

let isSetup = false

export function setupPersistence(store: { getState: () => { settings: SettingsState }; subscribe: (listener: () => void) => () => void }) {
  if (isSetup) return
  isSetup = true
  let previous = JSON.stringify(store.getState().settings)
  store.subscribe(() => {
    const current = store.getState().settings
    const serialized = JSON.stringify(current)
    if (serialized === previous) return
    previous = serialized
    localStorage.setItem('chatnip-settings', serialized)
    saveAppState('settings', current).catch(() => {})
  })
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setNapcatConfig(state, action: PayloadAction<Partial<SettingsState['napcat']>>) {
      state.napcat = { ...state.napcat, ...action.payload }
    },
    setOpencodeConfig(state, action: PayloadAction<Partial<SettingsState['opencode']>>) {
      state.opencode = { ...state.opencode, ...action.payload }
    },
    setDefaultMessageCount(state, action: PayloadAction<number>) {
      state.defaultMessageCount = action.payload
    },
    setDefaultFeatures(state, action: PayloadAction<string[]>) {
      state.defaultFeatures = action.payload
    },
    setDefaultModel(state, action: PayloadAction<ModelInfo | undefined>) {
      state.defaultModel = action.payload
    },
  },
})

export const {
  setNapcatConfig,
  setOpencodeConfig,
  setDefaultMessageCount,
  setDefaultFeatures,
  setDefaultModel,
} = settingsSlice.actions

export default settingsSlice.reducer
