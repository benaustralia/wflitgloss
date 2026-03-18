export const BUDGET = 5.00
const HAIKU_IN  = 0.80 / 1_000_000   // $ per input token
const HAIKU_OUT = 4.00 / 1_000_000   // $ per output token

export function calcCost(inputTokens, outputTokens) {
  return inputTokens * HAIKU_IN + outputTokens * HAIKU_OUT
}

async function getCreditsRef() {
  const [{ initializeApp, getApps }, { getFirestore, doc }] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
  ])
  const cfg = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  }
  const app = getApps().length ? getApps()[0] : initializeApp(cfg)
  return { ref: doc(getFirestore(app), 'config', 'credits'), onSnapshot: (await import('firebase/firestore')).onSnapshot }
}

export async function incrementSpent(inputTokens, outputTokens) {
  const cost = calcCost(inputTokens, outputTokens)
  const { setDoc, increment } = await import('firebase/firestore')
  const { ref } = await getCreditsRef()
  await setDoc(ref, { spent: increment(cost), translations: increment(1), budget: BUDGET }, { merge: true })
}

// Returns an unsubscribe function
export function subscribeToCredits(callback) {
  let cancel = () => {}
  getCreditsRef().then(({ ref, onSnapshot }) => {
    cancel = onSnapshot(ref, snap => {
      const data         = snap.exists() ? snap.data() : {}
      const spent        = data.spent        ?? 0
      const budget       = data.budget       ?? BUDGET
      const translations = data.translations ?? 0
      const remaining    = Math.max(0, budget - spent)
      const pct          = remaining / budget
      callback({ spent, budget, remaining, pct, translations })
    })
  })
  return () => cancel()
}
