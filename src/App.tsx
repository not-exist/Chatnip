import { Provider } from 'react-redux'
import { HeroUIProvider } from '@heroui/system'
import { Toaster } from 'react-hot-toast'
import { store } from '@/store'
import Router from '@/router'

export default function App() {
  return (
    <HeroUIProvider>
      <Provider store={store}>
        <Toaster
          position="top-right"
          toastOptions={{
            className: '!bg-background !text-foreground !border !border-default-200',
          }}
        />
        <Router />
      </Provider>
    </HeroUIProvider>
  )
}
