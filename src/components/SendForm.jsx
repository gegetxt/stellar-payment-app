import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  SendHorizontal,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  getAvailablePaymentBalance,
  isAmountWithinAvailableBalance,
  isPositiveXlmAmount,
} from "@/lib/stellarAmounts"
import { cn } from "@/lib/utils"

const STELLAR_EXPERT_TESTNET_URL = "https://stellar.expert/explorer/testnet"

const ERROR_CODES = {
  NOT_FUNDED: "NOT_FUNDED",
  INVALID_ADDRESS: "INVALID_ADDRESS",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  SIGNATURE_REJECTED: "SIGNATURE_REJECTED",
  NETWORK_ERROR: "NETWORK_ERROR",
}

function getExplorerUrl(hash) {
  return `${STELLAR_EXPERT_TESTNET_URL}/tx/${encodeURIComponent(hash)}`
}

function getPaymentErrorToast(error) {
  switch (error?.code) {
    case ERROR_CODES.NOT_FUNDED:
      return {
        title: "Account not funded",
        description:
          "This Testnet account is not active yet. Use Friendbot to get test XLM, then try again.",
      }
    case ERROR_CODES.SIGNATURE_REJECTED:
      return {
        title: "Signature rejected",
        description: "The Freighter signature request was canceled.",
      }
    case ERROR_CODES.INSUFFICIENT_BALANCE:
      return {
        title: "Insufficient balance",
        description: error.message,
      }
    case ERROR_CODES.INVALID_ADDRESS:
      return {
        title: "Invalid address",
        description: "The recipient address is not a valid Stellar public key.",
      }
    case ERROR_CODES.NETWORK_ERROR:
      return {
        title: "Network error",
        description: "Could not reach the Stellar network. Please try again.",
      }
    default:
      return {
        title: "Send failed",
        description: error?.message ?? "The transaction could not be completed.",
      }
  }
}

function SendForm({
  fromAddress,
  balance,
  isAccountNotFunded = false,
  isNetworkReady = true,
  disabledReason = "",
  onPaymentSuccess,
  className,
}) {
  const [toAddress, setToAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [isRecipientValid, setIsRecipientValid] = useState(false)
  const [hasRecipientValue, setHasRecipientValue] = useState(false)
  const [status, setStatus] = useState("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [transactionHash, setTransactionHash] = useState("")

  const availableBalance = useMemo(
    () => getAvailablePaymentBalance(balance),
    [balance],
  )
  const isSubmitting = status === "signing" || status === "submitting"
  const isSuccess = status === "success" && transactionHash
  const networkBlockerMessage = !isNetworkReady
    ? disabledReason ||
      "Freighter is not on Testnet. Switch the network to TESTNET to send."
    : ""
  const isSubmitDisabled = isSubmitting || Boolean(networkBlockerMessage)
  const statusLabel =
    status === "signing"
      ? "Waiting for signature..."
      : status === "submitting"
        ? "Sending..."
        : ""

  useEffect(() => {
    const address = toAddress.trim()
    let isStale = false

    setHasRecipientValue(Boolean(address))

    if (!address) {
      setIsRecipientValid(false)
      return undefined
    }

    import("@stellar/stellar-sdk").then(({ StrKey }) => {
      if (!isStale) {
        setIsRecipientValid(StrKey.isValidEd25519PublicKey(address))
      }
    })

    return () => {
      isStale = true
    }
  }, [toAddress])

  function setMaxAmount() {
    setAmount(availableBalance)
    setErrorMessage("")
  }

  async function copyHash() {
    try {
      await navigator.clipboard.writeText(transactionHash)
      toast.success("Hash copied")
    } catch {
      toast.error("Could not copy hash")
    }
  }

  function showErrorToast(error) {
    const toastContent = getPaymentErrorToast(error)
    toast.error(toastContent.title, {
      description: toastContent.description,
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage("")
    setTransactionHash("")

    if (!fromAddress) {
      const error = new Error("Connect your wallet to send.")
      setErrorMessage(error.message)
      toast.error("Wallet not connected", { description: error.message })
      return
    }

    if (networkBlockerMessage) {
      setErrorMessage(networkBlockerMessage)
      toast.error("Testnet required", { description: networkBlockerMessage })
      return
    }

    if (isAccountNotFunded) {
      const error = new Error(
        "This Testnet account is not funded. Use Friendbot to get test XLM, then try again.",
      )
      error.code = ERROR_CODES.NOT_FUNDED
      setErrorMessage(error.message)
      showErrorToast(error)
      return
    }

    if (!isRecipientValid) {
      const error = new Error("The recipient address is invalid.")
      error.code = ERROR_CODES.INVALID_ADDRESS
      setErrorMessage(error.message)
      showErrorToast(error)
      return
    }

    if (!isPositiveXlmAmount(amount)) {
      const error = new Error("Enter a valid XLM amount.")
      error.code = ERROR_CODES.INVALID_AMOUNT
      setErrorMessage(error.message)
      showErrorToast(error)
      return
    }

    if (!isAmountWithinAvailableBalance(amount, balance)) {
      const error = new Error(
        `Available balance is ${availableBalance} XLM after reserve and fee.`,
      )
      error.code = ERROR_CODES.INSUFFICIENT_BALANCE
      setErrorMessage(error.message)
      showErrorToast(error)
      return
    }

    setStatus("signing")

    try {
      const { PAYMENT_STEPS, sendPayment } = await import("@/services/stellar")
      const hash = await sendPayment(fromAddress, toAddress, amount, {
        onStatus: (nextStatus) => {
          if (nextStatus === PAYMENT_STEPS.AWAITING_SIGNATURE) {
            setStatus("signing")
          }

          if (nextStatus === PAYMENT_STEPS.SUBMITTING) {
            setStatus("submitting")
          }
        },
      })

      setTransactionHash(hash)
      setStatus("success")
      setAmount("")
      toast.success("Payment sent", {
        description: "Balance is refreshing automatically.",
      })
      onPaymentSuccess?.(hash)
    } catch (error) {
      setStatus("error")
      setErrorMessage(error?.message ?? "The transaction could not be completed.")
      showErrorToast(error)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1">
          <CardTitle>Send Payment</CardTitle>
          <CardDescription>Send native XLM on Stellar Testnet.</CardDescription>
        </div>
        <Badge
          variant={
            networkBlockerMessage || isAccountNotFunded
              ? "destructive"
              : fromAddress
                ? "secondary"
                : "outline"
          }
        >
          {networkBlockerMessage
            ? "Wrong network"
            : isAccountNotFunded
              ? "Not funded"
              : fromAddress
                ? "Ready"
                : "No wallet"}
        </Badge>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="toAddress">
              Recipient address
            </label>
            <div className="relative">
              <Input
                id="toAddress"
                value={toAddress}
                onChange={(event) => setToAddress(event.target.value)}
                placeholder="G..."
                autoComplete="off"
                className={cn(isRecipientValid && "pr-9")}
              />
              {isRecipientValid ? (
                <CheckCircle2 className="absolute right-2.5 top-2 size-4 text-emerald-600" />
              ) : null}
            </div>
            {hasRecipientValue && !isRecipientValid ? (
              <p className="text-sm text-destructive">
                Enter a valid Stellar public key.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium" htmlFor="amount">
                Amount
              </label>
              <span className="text-xs text-muted-foreground">
                Max: {availableBalance} XLM
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.0000001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.0000000"
              />
              <Button type="button" variant="outline" onClick={setMaxAmount}>
                Max
              </Button>
            </div>
          </div>

          {statusLabel ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {statusLabel}
            </div>
          ) : null}

          {networkBlockerMessage ? (
            <p className="text-sm text-destructive">{networkBlockerMessage}</p>
          ) : null}

          {isAccountNotFunded ? (
            <p className="text-sm text-destructive">
              This Testnet account is not funded. Use Friendbot to get test XLM
              before sending.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}

          {isSuccess ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Payment sent</p>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {transactionHash}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className={cn(buttonVariants({ variant: "outline" }))}
                  href={getExplorerUrl(transactionHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink data-icon="inline-start" />
                  Explorer
                </a>
                <Button type="button" variant="outline" onClick={copyHash}>
                  <Copy data-icon="inline-start" />
                  Copy
                </Button>
              </div>
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
            {isSubmitting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <SendHorizontal data-icon="inline-start" />
            )}
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export { SendForm }
export default SendForm
