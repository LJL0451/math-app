/* Minimal IndexedDB key-value stores: ink (working per question), kv (progress, settings, srs, templates). */
const DB = (() => {
  let dbp;
  function open() { if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open('penmaths', 1); r.onupgradeneeded = () => { r.result.createObjectStore('ink'); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return dbp; }
  async function op(store, mode, fn) { const db = await open(); return new Promise((res, rej) => { const tx = db.transaction(store, mode); const r = fn(tx.objectStore(store)); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }); }
  return { get: (s, k) => op(s, 'readonly', st => st.get(k)), set: (s, k, v) => op(s, 'readwrite', st => st.put(v, k)), del: (s, k) => op(s, 'readwrite', st => st.delete(k)), clear: s => op(s, 'readwrite', st => st.clear()) };
})();
