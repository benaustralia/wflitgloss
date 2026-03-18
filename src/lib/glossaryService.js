let _db = null

async function getDb() {
  if (_db) return _db
  const [{ initializeApp, getApps }, { getFirestore }] = await Promise.all([
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
  _db = getFirestore(app)
  return _db
}

export const glossaryService = {
  async getAllTerms() {
    const { collection, getDocs, query, orderBy } = await import('firebase/firestore')
    const db = await getDb()
    const col = collection(db, 'terms')
    try {
      const snap = await getDocs(query(col, orderBy('createdAt', 'desc')))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch (e) {
      if (e.code !== 'failed-precondition') throw e
      const snap = await getDocs(col)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0) || b.id.localeCompare(a.id))
    }
  },

  async addTerm(data) {
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
    const db = await getDb()
    const ref = await addDoc(collection(db, 'terms'), {
      ...data, tags: data.tags ?? [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    return ref.id
  },

  async updateTerm(id, data) {
    const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
    const db = await getDb()
    return updateDoc(doc(db, 'terms', id), { ...data, updatedAt: serverTimestamp() })
  },

  async deleteTerm(id) {
    const { doc, deleteDoc } = await import('firebase/firestore')
    const db = await getDb()
    return deleteDoc(doc(db, 'terms', id))
  },

  async getIPA(word) {
    if (!word) return null
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`)
      if (!res.ok) return null
      const [entry] = await res.json()
      return entry?.phonetic ?? entry?.phonetics?.find(p => p.text)?.text ?? null
    } catch { return null }
  },
}
