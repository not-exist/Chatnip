import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { bootstrapState } from './store/bootstrap'

async function start(): Promise<void> {
  await bootstrapState()
  const { default: App } = await import('./App')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void start()
