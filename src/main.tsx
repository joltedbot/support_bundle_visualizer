import React from 'react'
import ReactDOM from 'react-dom/client'
import createCache from '@emotion/cache'
import { EuiProvider } from '@elastic/eui'
import App from './App'

const cache = createCache({ key: 'eui', prepend: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EuiProvider colorMode="dark" cache={cache}>
      <App />
    </EuiProvider>
  </React.StrictMode>
)
