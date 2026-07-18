import { useState } from "react"
import { Wallet } from "lucide-react"
import { toast } from "sonner"

import { BalanceCard } from "@/components/BalanceCard"
import { SendForm } from "@/components/SendForm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/sonner"
import { REQUIRED_NETWORK, useFreighter } from "@/hooks/useFreighter"

const NOT_FUNDED_ERROR_CODE = "NOT_FUNDED"

function App() {
  const {
    address,
    connect,
    disconnect,
    error: walletError,
    isConnected,
    isLoading,
    network,
  } = useFreighter()
  const [balance, setBalance] = useState(null)
  const [balanceError, setBalanceError] = useState(null)
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0)

  const isWrongNetwork =
    isConnected && Boolean(network) && network !== REQUIRED_NETWORK
  const wrongNetworkMessage = isWrongNetwork
    ? `Freighter is on ${network}. Select ${REQUIRED_NETWORK} to send.`
    : ""
  const isAccountNotFunded = balanceError?.code === NOT_FUNDED_ERROR_CODE

  async function handleWalletClick() {
    if (isConnected) {
      disconnect()
      setBalance(null)
      setBalanceError(null)
      toast.success("Wallet disconnected")
      return
    }

    try {
      const result = await connect()
      setBalanceError(null)

      if (result.error) {
        toast.warning("Network warning", { description: result.error })
      } else {
        toast.success("Wallet connected")
      }
    } catch (error) {
      toast.error("Wallet connection failed", {
        description: error?.message ?? "Could not connect to Freighter.",
      })
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              SP
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Stellar Payment</div>
              <div className="text-xs text-muted-foreground">Payment dashboard</div>
            </div>
            <Badge
            variant={
                isWrongNetwork ? "destructive" : "secondary"
              }
              className="ml-1"
            >
              {isWrongNetwork ? network : "Testnet"}
            </Badge>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <Input
              aria-label="Wallet address"
              className="hidden w-56 sm:block"
              placeholder="Wallet not connected"
              value={address}
              readOnly
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleWalletClick}
              disabled={isLoading}
            >
              <Wallet data-icon="inline-start" />
              {isConnected ? "Disconnect" : "Connect"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {walletError ? (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {walletError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
          <BalanceCard
            address={address}
            onBalanceChange={setBalance}
            onBalanceErrorChange={setBalanceError}
            refreshKey={balanceRefreshKey}
          />
          <SendForm
            balance={balance}
            fromAddress={address}
            isAccountNotFunded={isAccountNotFunded}
            isNetworkReady={!isWrongNetwork}
            disabledReason={wrongNetworkMessage}
            onPaymentSuccess={() => {
              setBalanceRefreshKey((key) => key + 1)
            }}
          />
        </div>
      </main>

      <Toaster />
    </div>
  )
}

export default App
