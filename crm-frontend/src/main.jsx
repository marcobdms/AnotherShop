import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import './dashboard.css'
import Clientes from './Clientes.jsx'
import Dashboard from './Dashboard.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/clientes" replace />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/clientes" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
