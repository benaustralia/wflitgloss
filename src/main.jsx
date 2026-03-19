import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// rAF lets the browser paint the static HTML shell (in index.html) before
// React mounts, giving an instant FCP before the full JS bundle executes.
requestAnimationFrame(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
