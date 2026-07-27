import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../../frontend/src/index.css'
import Clientes from '../../frontend/src/pages/Clientes.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Clientes />
    </BrowserRouter>
  </React.StrictMode>,
)
