export const STROOPS_PER_XLM = 10_000_000n
export const MIN_ACCOUNT_RESERVE_STROOPS = STROOPS_PER_XLM
export const BASE_FEE_STROOPS = 100n

const XLM_AMOUNT_PATTERN = /^\d+(?:\.\d{1,7})?$/

export function xlmToStroops(amount) {
  const value = String(amount ?? "").trim()

  if (!XLM_AMOUNT_PATTERN.test(value)) {
    return null
  }

  const [whole, fraction = ""] = value.split(".")
  const stroops =
    BigInt(whole) * STROOPS_PER_XLM +
    BigInt(fraction.padEnd(7, "0") || "0")

  return stroops
}

export function stroopsToXlm(stroops) {
  const value = BigInt(stroops)
  const whole = value / STROOPS_PER_XLM
  const fraction = value % STROOPS_PER_XLM

  if (fraction === 0n) {
    return whole.toString()
  }

  return `${whole}.${fraction.toString().padStart(7, "0").replace(/0+$/, "")}`
}

export function getAvailablePaymentBalance(balance) {
  const balanceStroops = xlmToStroops(balance) ?? 0n
  const availableStroops =
    balanceStroops - MIN_ACCOUNT_RESERVE_STROOPS - BASE_FEE_STROOPS

  return stroopsToXlm(availableStroops > 0n ? availableStroops : 0n)
}

export function isPositiveXlmAmount(amount) {
  const stroops = xlmToStroops(amount)

  return stroops !== null && stroops > 0n
}

export function isAmountWithinAvailableBalance(amount, balance) {
  const amountStroops = xlmToStroops(amount)
  const balanceStroops = xlmToStroops(balance)

  if (amountStroops === null || balanceStroops === null) {
    return false
  }

  const availableStroops =
    balanceStroops - MIN_ACCOUNT_RESERVE_STROOPS - BASE_FEE_STROOPS

  return amountStroops <= availableStroops
}
