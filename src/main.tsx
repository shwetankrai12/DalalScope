import React from 'react'
import ReactDOM from 'react-dom/client'
import { StockTrendsCarousel } from './components/ui/stock-trends-carousel'
import './index.css'

const rootElement = document.getElementById('stock-trends-root')
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <StockTrendsCarousel />
    </React.StrictMode>
  )
}
