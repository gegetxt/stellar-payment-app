import { useCallback, useEffect, useMemo, useState } from "react"
import { ExternalLink, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const NOT_FUNDED_ERROR_CODE = "NOT_FUNDED"

function formatBalance(balance) {
  if (!balance) return "0.0000000"

  const [whole, fraction = ""] = balance.split(".")
  const trimmedFraction = fraction.slice(0, 7)

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

function BalanceSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Balance loading">
      <div className="space-y-2">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-12 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred while fetching the balance."
}

function BalanceCard({
  address,
  className,
  onBalanceChange,
  onBalanceErrorChange,
  refreshKey = 0,
}) {
  const [balance, setBalance] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const friendbotUrl = useMemo(() => {
    if (!address) return ""

    return `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`
  }, [address])

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setBalance(null)
      setError(null)
      onBalanceChange?.(null)
      onBalanceErrorChange?.(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { getBalance } = await import("@/services/stellar")
      const nextBalance = await getBalance(address)
      setBalance(nextBalance)
      onBalanceChange?.(nextBalance)
      onBalanceErrorChange?.(null)
    } catch (caughtError) {
      setBalance(null)
      setError(caughtError)
      onBalanceChange?.(null)
      onBalanceErrorChange?.(caughtError)
    } finally {
      setIsLoading(false)
    }
  }, [address, onBalanceChange, onBalanceErrorChange])

  useEffect(() => {
    refreshBalance()
  }, [refreshBalance, refreshKey])

  const isNotFunded = error?.code === NOT_FUNDED_ERROR_CODE

  return (
    <Card className={className}>
      <CardHeader className="grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1">
          <CardTitle>XLM Balance</CardTitle>
          <CardDescription>Stellar Testnet native asset balance.</CardDescription>
        </div>
        <Badge variant={isNotFunded ? "destructive" : "secondary"}>
          {address ? "Testnet" : "No wallet"}
        </Badge>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <BalanceSkeleton />
        ) : (
          <div className="space-y-5">
            {isNotFunded ? (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Account not funded</p>
                  <p className="text-sm text-muted-foreground">
                    This Testnet account was not found on Horizon. Use Friendbot
                    to get test XLM and activate the account.
                  </p>
                </div>

                {friendbotUrl ? (
                  <a
                    className={cn(buttonVariants({ variant: "outline" }))}
                    href={friendbotUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink data-icon="inline-start" />
                    Friendbot
                  </a>
                ) : null}
              </div>
            ) : (
              <div>
                <div className="text-sm text-muted-foreground">Available</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-4xl font-semibold tracking-normal">
                    {address ? formatBalance(balance) : "--"}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    XLM
                  </span>
                </div>
                {error ? (
                  <p className="mt-3 text-sm text-destructive">
                    {getErrorMessage(error)}
                  </p>
                ) : null}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={refreshBalance}
              disabled={!address || isLoading}
            >
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { BalanceCard }
export default BalanceCard
