// Firestore adapter (firebase-admin) + push notifier. The admin SDK bypasses security rules,
// which is exactly why the weekly engine, not the client, is allowed to create matches.
import admin from 'firebase-admin';

export function connect() {
  if (!admin.apps.length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    admin.initializeApp(sa
      ? { credential: admin.credential.cert(JSON.parse(sa)) }
      : { projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT });
  }
  const fs = admin.firestore();
  fs.settings({ ignoreUndefinedProperties: true });
  const db = {
    newId: name => fs.collection(name).doc().id,
    async list(name, filters = []) {
      let q = fs.collection(name);
      for (const [f, op, v] of filters) q = q.where(f, op, v);
      return (await q.get()).docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async get(name, id) { const s = await fs.collection(name).doc(id).get(); return s.exists ? { id, ...s.data() } : null; },
    async set(name, id, data) { await fs.collection(name).doc(id).set(data); },
    async merge(name, id, patch) { await fs.collection(name).doc(id).set(patch, { merge: true }); },
    async del(name, id) { await fs.collection(name).doc(id).delete(); },
  };
  const notify = async (uid, { title, body, url = '/' }) => {
    try {
      const u = await db.get('users', uid);
      const tokens = u?.fcmTokens || [];
      if (!tokens.length) return;
      const res = await admin.messaging().sendEachForMulticast({ tokens, data: { title, body, url } });
      const dead = tokens.filter((_, i) => !res.responses[i].success && /not-registered|invalid/.test(res.responses[i].error?.code || ''));
      if (dead.length) await db.merge('users', uid, { fcmTokens: tokens.filter(t => !dead.includes(t)) });
    } catch (e) { console.warn('push failed for', uid, e.message); }
  };
  return { db, notify };
}
