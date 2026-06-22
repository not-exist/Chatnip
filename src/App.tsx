import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import { store } from '@/store'
import Router from '@/router'

export default function App() {
  return (
    <Provider store={store}>
        <Toaster
          position="top-right"
          toastOptions={{
            className: '!bg-background !text-foreground !border !border-default-200',
          }}
        />
        <Router />
    </Provider>
  )
}
