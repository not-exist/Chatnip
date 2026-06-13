import { configureStore } from '@reduxjs/toolkit'
import { useSelector, useDispatch, type TypedUseSelectorHook } from 'react-redux'
import settingsReducer, { setupPersistence } from './settingsSlice'

export const store = configureStore({
  reducer: {
    settings: settingsReducer,
  },
})

setupPersistence(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
export const useAppDispatch = () => useDispatch<AppDispatch>()
