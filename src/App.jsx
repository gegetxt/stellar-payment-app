import { Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/sonner"

function App() {
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
            <Badge variant="secondary" className="ml-1">
              Testnet
            </Badge>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <Input
              aria-label="Wallet address"
              className="hidden w-56 sm:block"
              placeholder="Wallet not connected"
              readOnly
            />
            <Button type="button" variant="outline">
              <Wallet data-icon="inline-start" />
              Connect
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Main Content</CardTitle>
            <CardDescription>
              Stellar payment flow will be built here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-80 rounded-lg border border-dashed bg-muted/30" />
          </CardContent>
        </Card>
      </main>

      <Toaster />
    </div>
  )
}

export default App
