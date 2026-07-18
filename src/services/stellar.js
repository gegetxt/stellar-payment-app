import freighterApi from "@stellar/freighter-api"
import {
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk"

import {
  getAvailablePaymentBalance,
  isAmountWithinAvailableBalance,
  isPositiveXlmAmount,
  xlmToStroops,
  stroopsToXlm,
} from "../lib/stellarAmounts.js"

const { signTransaction } = freighterApi

export const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org"
export const STELLAR_EXPERT_TESTNET_URL = "https://stellar.expert/explorer/testnet"

export const STELLAR_ERROR_CODES = {
  NOT_FUNDED: "NOT_FUNDED",
  INVALID_ADDRESS: "INVALID_ADDRESS",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  SIGNATURE_REJECTED: "SIGNATURE_REJECTED",
  NETWORK_ERROR: "NETWORK_ERROR",
  HORIZON_ERROR: "HORIZON_ERROR",
}

export const PAYMENT_STEPS = {
  AWAITING_SIGNATURE: "AWAITING_SIGNATURE",
  SUBMITTING: "SUBMITTING",
}

export class StellarServiceError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = "StellarServiceError"
    this.code = code
    this.cause = cause
  }
}

const horizonServer = new Horizon.Server(HORIZON_TESTNET_URL)

function isNotFoundError(error) {
  const status =
    error?.response?.status ||
    error?.response?.data?.status ||
    error?.status ||
    error?.statusCode

  return Number(status) === 404
}

function getNativeBalance(account) {
  return account.balances.find((balance) => balance.asset_type === "native")
}

function getErrorDetails(error) {
  return JSON.stringify(
    {
      message: error?.message,
      response: error?.response?.data,
      resultCodes: error?.response?.data?.extras?.result_codes,
    },
    null,
    2,
  ).toLowerCase()
}

function isRejectedSignatureError(error) {
  const message = String(error?.message ?? error?.error?.message ?? "").toLowerCase()

  return (
    message.includes("declin") ||
    message.includes("denied") ||
    message.includes("reject") ||
    message.includes("cancel")
  )
}

function isInsufficientBalanceError(error) {
  const details = getErrorDetails(error)

  return (
    details.includes("insufficient") ||
    details.includes("underfunded") ||
    details.includes("op_underfunded") ||
    details.includes("op_low_reserve") ||
    details.includes("tx_insufficient_balance")
  )
}

function isNetworkError(error) {
  return !error?.response
}

function assertValidAddress(address, label) {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new StellarServiceError(
      STELLAR_ERROR_CODES.INVALID_ADDRESS,
      `${label} address is invalid.`,
    )
  }
}

function assertValidPaymentAmount(amount) {
  if (!isPositiveXlmAmount(amount)) {
    throw new StellarServiceError(
      STELLAR_ERROR_CODES.INVALID_AMOUNT,
      "The amount must be positive with up to 7 decimal places.",
    )
  }
}

function normalizePaymentAmount(amount) {
  const stroops = xlmToStroops(amount)

  if (stroops === null || stroops <= 0n) {
    throw new StellarServiceError(
      STELLAR_ERROR_CODES.INVALID_AMOUNT,
      "The amount must be positive with up to 7 decimal places.",
    )
  }

  return stroopsToXlm(stroops)
}

export async function getBalance(address) {
  if (!address) {
    throw new StellarServiceError(
      STELLAR_ERROR_CODES.INVALID_ADDRESS,
      "Enter a valid Stellar address to check the balance.",
    )
  }

  try {
    const account = await horizonServer.loadAccount(address)
    const nativeBalance = getNativeBalance(account)

    return nativeBalance?.balance ?? "0.0000000"
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new StellarServiceError(
        STELLAR_ERROR_CODES.NOT_FUNDED,
        "This Testnet account is not funded yet.",
        error,
      )
    }

    throw new StellarServiceError(
      STELLAR_ERROR_CODES.HORIZON_ERROR,
      "Could not fetch the XLM balance from Horizon.",
      error,
    )
  }
}

export async function sendPayment(
  fromAddress,
  toAddress,
  amount,
  options = {},
) {
  const sourceAddress = String(fromAddress ?? "").trim()
  const destinationAddress = String(toAddress ?? "").trim()
  const onStatus = options.onStatus ?? (() => {})

  assertValidAddress(sourceAddress, "Sender")
  assertValidAddress(destinationAddress, "Recipient")
  assertValidPaymentAmount(amount)

  const paymentAmount = normalizePaymentAmount(amount)

  try {
    const account = await horizonServer.loadAccount(sourceAddress)
    const nativeBalance = getNativeBalance(account)?.balance ?? "0.0000000"

    if (!isAmountWithinAvailableBalance(paymentAmount, nativeBalance)) {
      throw new StellarServiceError(
        STELLAR_ERROR_CODES.INSUFFICIENT_BALANCE,
        `Insufficient balance. Available balance: ${getAvailablePaymentBalance(
          nativeBalance,
        )} XLM.`,
      )
    }

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: destinationAddress,
          asset: Asset.native(),
          amount: paymentAmount,
        }),
      )
      .setTimeout(180)
      .build()

    onStatus(PAYMENT_STEPS.AWAITING_SIGNATURE)

    const signatureResult = await signTransaction(transaction.toXDR(), {
      address: sourceAddress,
      networkPassphrase: Networks.TESTNET,
    })

    if (signatureResult.error) {
      throw new StellarServiceError(
        isRejectedSignatureError(signatureResult.error)
          ? STELLAR_ERROR_CODES.SIGNATURE_REJECTED
          : STELLAR_ERROR_CODES.HORIZON_ERROR,
        isRejectedSignatureError(signatureResult.error)
          ? "Freighter signature request was rejected."
          : signatureResult.error.message,
        signatureResult.error,
      )
    }

    if (!signatureResult.signedTxXdr) {
      throw new StellarServiceError(
        STELLAR_ERROR_CODES.SIGNATURE_REJECTED,
        "Freighter signature request was not completed.",
      )
    }

    onStatus(PAYMENT_STEPS.SUBMITTING)

    const signedTransaction = TransactionBuilder.fromXDR(
      signatureResult.signedTxXdr,
      Networks.TESTNET,
    )
    const submitResult = await horizonServer.submitTransaction(signedTransaction)

    return submitResult.hash
  } catch (error) {
    if (error instanceof StellarServiceError) {
      throw error
    }

    if (isRejectedSignatureError(error)) {
      throw new StellarServiceError(
        STELLAR_ERROR_CODES.SIGNATURE_REJECTED,
        "Freighter signature request was rejected.",
        error,
      )
    }

    if (isNotFoundError(error)) {
      throw new StellarServiceError(
        STELLAR_ERROR_CODES.NOT_FUNDED,
        "The sender Testnet account is not funded yet.",
        error,
      )
    }

    if (isInsufficientBalanceError(error)) {
      throw new StellarServiceError(
        STELLAR_ERROR_CODES.INSUFFICIENT_BALANCE,
        "The transaction could not be sent because of insufficient balance or reserve requirements.",
        error,
      )
    }

    if (isNetworkError(error)) {
      throw new StellarServiceError(
        STELLAR_ERROR_CODES.NETWORK_ERROR,
        "Could not reach the Stellar network. Check your connection and try again.",
        error,
      )
    }

    throw new StellarServiceError(
      STELLAR_ERROR_CODES.HORIZON_ERROR,
      "Horizon rejected the Stellar transaction.",
      error,
    )
  }
}
