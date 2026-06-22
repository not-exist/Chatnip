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
            className: '!bg-white dark:!bg-gray-950 !text-gray-900 dark:!text-gray-100 !border !border-gray-200 dark:!border-gray-700',
          }}
        />
        <Router />
    </Provider>
  )
}
