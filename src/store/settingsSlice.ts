import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { SettingsState, ModelInfo } from '@/types'

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

function persist(state: SettingsState) {
  localStorage.setItem('chatnip-settings', JSON.stringify(state))
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setNapcatConfig(state, action: PayloadAction<Partial<SettingsState['napcat']>>) {
      state.napcat = { ...state.napcat, ...action.payload }
      persist(state)
    },
    setOpencodeConfig(state, action: PayloadAction<Partial<SettingsState['opencode']>>) {
      state.opencode = { ...state.opencode, ...action.payload }
      persist(state)
    },
    setDefaultMessageCount(state, action: PayloadAction<number>) {
      state.defaultMessageCount = action.payload
      persist(state)
    },
    setDefaultFeatures(state, action: PayloadAction<string[]>) {
      state.defaultFeatures = action.payload
      persist(state)
    },
    setDefaultModel(state, action: PayloadAction<ModelInfo | undefined>) {
      state.defaultModel = action.payload
      persist(state)
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
