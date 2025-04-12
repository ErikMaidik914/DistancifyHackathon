import Dashboard from "@/components/dashboard"
import { DebugPanel } from "@/components/debug-panel"

// Update the component to include DebugPanel and ApiErrorMonitor in all modes
export default function Home() {
  return (
    <>
      <Dashboard />
      <DebugPanel />
    </>
  )
}
