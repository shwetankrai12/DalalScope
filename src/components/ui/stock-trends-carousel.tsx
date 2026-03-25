"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TrendingUp, TrendingDown, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent } from "./card"
import { Button } from "./button"
import { cn } from "../../lib/utils"

interface Stock {
  ticker: string
  name: string
  logoUrl: string
  price: number
  currency: string
  changePercent: number
}

const DEFAULT_TICKERS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "WIPRO", "BAJFINANCE", "ITC"]

const StockTrendsCarousel = () => {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Use a 5-day history window to always get prev_close
      const today = new Date()
      const end = today.toISOString().split('T')[0]
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 7)
      const start = startDate.toISOString().split('T')[0]

      const results = await Promise.all(
        DEFAULT_TICKERS.map(async (ticker) => {
          const res = await fetch(`/api/stock/history?ticker=${ticker}&start=${start}&end=${end}`)
          if (!res.ok) return null
          const rows: Array<{Date: number; Close: number; Open: number; High: number; Low: number; Volume: number}> = await res.json()
          if (!rows || rows.length === 0) return null
          
          const latest = rows[rows.length - 1]
          const prev = rows.length >= 2 ? rows[rows.length - 2] : null
          const changePercent = prev ? ((latest.Close - prev.Close) / prev.Close) * 100 : 0

          const domainMap: Record<string, string> = {
            RELIANCE: "ril.com",
            TCS: "tcs.com",
            HDFCBANK: "hdfcbank.com",
            INFY: "infosys.com",
            WIPRO: "wipro.com",
            BAJFINANCE: "bajajfinserv.in",
            ITC: "itcportal.com"
          }

          return {
            ticker,
            name: ticker,
            logoUrl: `https://logo.clearbit.com/${domainMap[ticker] || 'placeholder.com'}`,
            price: latest.Close,
            currency: "INR",
            changePercent
          } as Stock
        })
      )
      setStocks(results.filter((s): s is Stock => s !== null))
    } catch (err) {
      console.error("Failed to fetch carousel data", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // Refresh every 1 min
    return () => clearInterval(interval)
  }, [])

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 3 >= stocks.length ? 0 : prev + 1))
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? Math.max(0, stocks.length - 3) : prev - 1))
  }

  if (loading && stocks.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-[#0d1520] border border-[#1a2d47] rounded-xl h-[180px]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#00c896]" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-4 font-mono text-[#e2eaf4]">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🇮🇳 NSE Stocks <span className="text-xs font-normal opacity-50 px-2 py-0.5 border border-[#1a2d47] rounded uppercase">Live</span>
          </h2>
          <p className="text-xs text-[#5b7aa0] font-sans">Community Trends</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 bg-[#111c2d] border-[#1a2d47] hover:bg-[#1e4080]"
            onClick={prevSlide}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 bg-[#111c2d] border-[#1a2d47] hover:bg-[#1e4080]"
            onClick={nextSlide}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden w-full">
        <div className="flex flex-row flex-nowrap gap-4 w-full">
          <AnimatePresence mode="popLayout" initial={false}>
            {stocks.slice(currentIndex, currentIndex + 4).map((stock) => (
              <motion.div
                key={stock.ticker}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex-shrink-0 w-[180px]"
              >
                <Card
                  className="bg-[#0b121c] border-[#1e293b] hover:border-[#00c896]/50 transition-all duration-300 group shadow-lg cursor-pointer overflow-hidden box-border"
                  onClick={() => {
                    const fn = (window as any).quickSearch
                    if (typeof fn === 'function') fn(`${stock.ticker}.NS`)
                  }}
                >
                  <CardContent className="p-3 relative">
                    <div className="flex items-start justify-between gap-1.5 w-full mb-4">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded shadow-inner bg-[#1e293b]/50 flex items-center justify-center p-1 border border-[#334155] group-hover:border-[#00c896]/30 overflow-hidden shrink-0">
                          <img 
                            src={stock.logoUrl} 
                            alt={stock.name} 
                            className="w-full h-full object-contain brightness-110 contrast-125"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-br', 'from-[#1e293b]', 'to-[#0f172a]');
                            }}
                          />
                          <span className="text-[10px] font-bold text-[#00c896] selection-none">
                            {stock.ticker.substring(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold tracking-tight truncate">{stock.ticker}</p>
                          <p className="text-[9px] text-[#64748b] font-sans uppercase tracking-widest truncate">NSE</p>
                        </div>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap",
                        stock.changePercent >= 0 
                          ? "text-[#00c896] bg-[#00c896]/5 border-[#00c896]/20" 
                          : "text-[#f43f5e] bg-[#f43f5e]/5 border-[#f43f5e]/20"
                      )}>
                        {stock.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(stock.changePercent).toFixed(2)}%
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] text-[#5b7aa0] font-sans">LAST PRICE</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold leading-none">
                          {new Intl.NumberFormat('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(stock.price)}
                        </span>
                        <span className="text-[10px] text-[#5b7aa0] uppercase">{stock.currency}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export { StockTrendsCarousel }
