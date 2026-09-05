import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shell from '@/components/layout/Shell';
import Hub from '@/pages/Hub';
import ClientDialer from '@/pages/ClientDialer';
import FraudDashboard from '@/pages/FraudDashboard';
import { useSpectraSocket } from '@/hooks/useSpectraSocket';

/**
 * App — Root route switcher with shared WebSocket telemetry context.
 */
export default function App() {
  const { telemetry, riskHistory, isConnected, latencyMs, reconnect } =
    useSpectraSocket();

  return (
    <BrowserRouter>
      <Shell isConnected={isConnected} latencyMs={latencyMs}>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route
            path="/dialer"
            element={<ClientDialer telemetry={telemetry} />}
          />
          <Route
            path="/dashboard"
            element={
              <FraudDashboard
                telemetry={telemetry}
                riskHistory={riskHistory}
                isConnected={isConnected}
                latencyMs={latencyMs}
                onReconnect={reconnect}
              />
            }
          />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
