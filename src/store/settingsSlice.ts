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

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem('chatnip-settings')
    if (raw) {
      return JSON.parse(raw)
    }
  } catch { /* ignore */ }
  return {
    napcat: defaultNapcatConfig,
    opencode: defaultOpencodeConfig,
    defaultMessageCount: 200,
    defaultFeatures: ['summary', 'topics', 'sentiment'],
    defaultModel: undefined,
  }
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
