import { db } from '@/lib/firebase'
import { doc, onSnapshot, setDoc, increment } from 'firebase/firestore'

export const BUDGET = 5.00
const HAIKU_IN  = 0.80 / 1_000_000   // $ per input token
const HAIKU_OUT = 4.00 / 1_000_000   // $ per output token

const creditsRef = doc(db, 'config', 'credits')

export function calcCost(inputTokens, outputTokens) {
  return inputTokens * HAIKU_IN + outputTokens * HAIKU_OUT
}

export async function incrementSpent(inputTokens, outputTokens) {
  const cost = calcCost(inputTokens, outputTokens)
  await setDoc(creditsRef, {
    spent: increment(cost),
    translations: increment(1),
    budget: BUDGET,
  }, { merge: true })
}

// Returns an unsubscribe function
export function subscribeToCredits(callback) {
  return onSnapshot(creditsRef, snap => {
    const data  = snap.exists() ? snap.data() : {}
    const spent = data.spent        ?? 0
    const budget = data.budget      ?? BUDGET
    const translations = data.translations ?? 0
    const remaining    = Math.max(0, budget - spent)
    const pct          = remaining / budget
    callback({ spent, budget, remaining, pct, translations })
  })
}
