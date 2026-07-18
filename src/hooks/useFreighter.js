import { useCallback, useState } from "react"
import freighterApi from "@stellar/freighter-api"

const {
  getAddress,
  getNetwork,
  isConnected: checkFreighterConnection,
  requestAccess,
} = freighterApi

export const FREIGHTER_INSTALL_URL = "https://freighter.app"
export const REQUIRED_NETWORK = "TESTNET"

const INITIAL_STATE = {
  address: "",
  isConnected: false,
  network: "",
  isLoading: false,
  error: null,
}

const ERROR_MESSAGES = {
  extensionMissing: `Freighter extension was not found. Install Freighter to continue: ${FREIGHTER_INSTALL_URL}`,
  permissionDenied:
    "Freighter connection permission was rejected. Approve the request to connect your wallet.",
  walletLocked:
    "Freighter appears to be locked. Open the extension and unlock it with your password.",
  connectionCheck:
    "Freighter connection could not be checked. Make sure the extension is open.",
  accessFailed: "Freighter access could not be granted. Please try again.",
  addressFailed:
    "Freighter address could not be read. Make sure your wallet is unlocked.",
  networkFailed: "Freighter network could not be read. Check the extension and try again.",
}

function createFreighterError(message, cause) {
  const error = new Error(message)
  error.name = "FreighterError"
  error.cause = cause
  return error
}

function getApiErrorMessage(error) {
  if (!error) return ""
  if (typeof error === "string") return error
  if (typeof error.message === "string") return error.message
  return ""
}

function normalizeApiError(error, fallbackMessage) {
  const rawMessage = getApiErrorMessage(error)
  const message = rawMessage.toLowerCase()

  if (
    message.includes("declin") ||
    message.includes("denied") ||
    message.includes("reject") ||
    message.includes("not allowed")
  ) {
    return ERROR_MESSAGES.permissionDenied
  }

  if (
    message.includes("lock") ||
    message.includes("password") ||
    message.includes("unlock")
  ) {
    return ERROR_MESSAGES.walletLocked
  }

  return rawMessage ? `${fallbackMessage} ${rawMessage}` : fallbackMessage
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred while connecting to Freighter."
}

function getNetworkWarning(network) {
  if (!network || network === REQUIRED_NETWORK) return null

  return `Freighter is connected to ${network}. This app expects ${REQUIRED_NETWORK}; switch Freighter to ${REQUIRED_NETWORK}.`
}

export function useFreighter() {
  const [address, setAddress] = useState(INITIAL_STATE.address)
  const [isConnected, setIsConnected] = useState(INITIAL_STATE.isConnected)
  const [network, setNetwork] = useState(INITIAL_STATE.network)
  const [isLoading, setIsLoading] = useState(INITIAL_STATE.isLoading)
  const [error, setError] = useState(INITIAL_STATE.error)

  const resetState = useCallback(() => {
    setAddress(INITIAL_STATE.address)
    setIsConnected(INITIAL_STATE.isConnected)
    setNetwork(INITIAL_STATE.network)
    setIsLoading(INITIAL_STATE.isLoading)
    setError(INITIAL_STATE.error)
  }, [])

  const connect = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const connectionResult = await checkFreighterConnection()

      if (connectionResult.error) {
        throw createFreighterError(
          normalizeApiError(connectionResult.error, ERROR_MESSAGES.connectionCheck),
          connectionResult.error,
        )
      }

      if (!connectionResult.isConnected) {
        throw createFreighterError(ERROR_MESSAGES.extensionMissing)
      }

      const accessResult = await requestAccess()

      if (accessResult.error) {
        throw createFreighterError(
          normalizeApiError(accessResult.error, ERROR_MESSAGES.accessFailed),
          accessResult.error,
        )
      }

      if (!accessResult.address) {
        throw createFreighterError(ERROR_MESSAGES.walletLocked)
      }

      const addressResult = await getAddress()

      if (addressResult.error) {
        throw createFreighterError(
          normalizeApiError(addressResult.error, ERROR_MESSAGES.addressFailed),
          addressResult.error,
        )
      }

      const nextAddress = addressResult.address || accessResult.address

      if (!nextAddress) {
        throw createFreighterError(ERROR_MESSAGES.walletLocked)
      }

      const networkResult = await getNetwork()

      if (networkResult.error) {
        throw createFreighterError(
          normalizeApiError(networkResult.error, ERROR_MESSAGES.networkFailed),
          networkResult.error,
        )
      }

      const nextNetwork = networkResult.network || ""
      const networkWarning = getNetworkWarning(nextNetwork)

      setAddress(nextAddress)
      setIsConnected(true)
      setNetwork(nextNetwork)
      setError(networkWarning)

      return {
        address: nextAddress,
        isConnected: true,
        network: nextNetwork,
        error: networkWarning,
      }
    } catch (caughtError) {
      const message = getErrorMessage(caughtError)

      setAddress("")
      setIsConnected(false)
      setNetwork("")
      setError(message)

      throw caughtError instanceof Error
        ? caughtError
        : createFreighterError(message, caughtError)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    resetState()
  }, [resetState])

  return {
    address,
    isConnected,
    network,
    isLoading,
    error,
    connect,
    disconnect,
  }
}
