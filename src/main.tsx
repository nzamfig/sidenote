/**
 * @file main.tsx
 * Application entry point.
 *
 * Mounts the root component using React 18's createRoot API.
 * StrictMode: intentionally double-renders components and double-invokes Effects in development
 * to surface potential bugs such as side-effect dependencies and deprecated API usage early.
 * StrictMode has no effect on production builds.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
