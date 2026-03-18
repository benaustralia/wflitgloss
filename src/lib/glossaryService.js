import { db } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp, where } from 'firebase/firestore'

const col = () => collection(db, 'terms')

async function run(q, fallback) {
  try {
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    if (e.code !== 'failed-precondition') throw e
    const snap = await getDocs(fallback)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0) || b.id.localeCompare(a.id))
  }
}

export const glossaryService = {
  getAllTerms:   () => run(query(col(), orderBy('createdAt', 'desc')), col()),
  getTermsByTag: (tag) => run(query(col(), where('tags', 'array-contains', tag), orderBy('createdAt', 'desc')), query(col(), where('tags', 'array-contains', tag))),
  addTerm:       (data) => addDoc(col(), { ...data, tags: data.tags ?? [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }).then(d => d.id),
  updateTerm:    (id, data) => updateDoc(doc(db, 'terms', id), { ...data, updatedAt: serverTimestamp() }),
  deleteTerm:    (id) => deleteDoc(doc(db, 'terms', id)),

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
