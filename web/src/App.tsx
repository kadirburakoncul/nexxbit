import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import ErrorBoundary from '@/components/ErrorBoundary'
import ScrollToTop from '@/components/ScrollToTop'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import CoinsPage from '@/pages/CoinsPage'
import SignalsPage from '@/pages/SignalsPage'
import PositionsPage from '@/pages/PositionsPage'
import NotificationsPage from '@/pages/NotificationsPage'
import BinancePage from '@/pages/BinancePage'
import SettingsPage from '@/pages/SettingsPage'
import AdminPage from '@/pages/AdminPage'
import RegisterPage from '@/pages/RegisterPage'
import ChartPage from '@/pages/ChartPage'
import AdminLogsPage from '@/pages/AdminLogsPage'
import BacktestPage from '@/pages/BacktestPage'
import IndicatorPage from '@/pages/IndicatorPage'
import StrategyPage from '@/pages/StrategyPage'
import TradesPage from '@/pages/TradesPage'
import MonitorPage from '@/pages/MonitorPage'
import VolatilePage from '@/pages/VolatilePage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{ style: { background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' } }}
        />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/coins" element={<CoinsPage />} />
            <Route path="/signals" element={<SignalsPage />} />
            <Route path="/positions" element={<PositionsPage />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/binance" element={<BinancePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/indicators" element={<IndicatorPage />} />
            <Route path="/strategies" element={<StrategyPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/volatile" element={<VolatilePage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route path="/chart" element={<ChartPage />} />
            <Route path="/admin/logs" element={<AdminLogsPage />} />
            <Route path="/backtest" element={<BacktestPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
