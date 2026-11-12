// Firebase implementation of the data layer (Auth + Firestore + optional push). No backend of our own.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink, signOut, deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, collection, query, where, addDoc, writeBatch, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, VAPID_KEY, UPI } from './config.js';
import { lsGet, lsSet, lsDel } from './ui.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

const rows = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
const listen = (q, cb) => onSnapshot(q, s => cb(rows(s)), e => console.error('listen', e.code, e.message));
const one = (ref, cb) => onSnapshot(ref, s => cb(s.exists() ? { id: s.id, ...s.data() } : null), e => { console.error('doc', e.code); cb(null); });
const WOMAN_VISIBLE = ['offered', 'confirmed', 'declined', 'completed', 'noshow_w', 'noshow_m', 'expired']; // must match firestore.rules

export const api = {
  mode: 'firebase',
  now: () => Date.now(),

  auth: {
    onChange: cb => onAuthStateChanged(auth, u => cb(u && { uid: u.uid, email: u.email, name: u.displayName })),
    async signInGoogle() {
      const p = new GoogleAuthProvider();
      if (matchMedia('(display-mode: standalone)').matches) return signInWithRedirect(auth, p);
      return signInWithPopup(auth, p);
    },
    async sendLink(email) {
      await sendSignInLinkToEmail(auth, email, { url: location.origin + '/', handleCodeInApp: true });
      lsSet('emailForSignIn', email);
    },
    async finishLink() {
      if (!isSignInWithEmailLink(auth, location.href)) return false;
      const email = lsGet('emailForSignIn', null) || prompt('Confirm your email to finish signing in');
      if (!email) return false;
      await signInWithEmailLink(auth, email, location.href);
      lsDel('emailForSignIn'); history.replaceState(null, '', location.pathname + '#/');
      return true;
    },
    signOut: () => signOut(auth),
  },

  profile: {
    watch: (uid, cb) => one(doc(db, 'users', uid), cb),
    create: (uid, data) => setDoc(doc(db, 'users', uid), { ...data, status: 'pending', verified: false, createdAt: Date.now() }),
    update: (uid, patch) => updateDoc(doc(db, 'users', uid), { ...patch, updatedAt: Date.now() }),
    async selfie(uid, dataUrl) { await setDoc(doc(db, 'verifications', uid), { selfie: dataUrl, createdAt: Date.now() }); },
    async isAdmin(uid) { try { return (await getDoc(doc(db, 'admins', uid))).exists(); } catch { return false; } },
    async remove(uid) {
      const week = (await import('./shared/schedule.js')).cycleAt(Date.now()).id;
      await deleteDoc(doc(db, 'optins', `${week}_${uid}`)).catch(() => {});
      await deleteDoc(doc(db, 'verifications', uid)).catch(() => {});
      await deleteDoc(doc(db, 'users', uid));
      await deleteUser(auth.currentUser);
    },
    async pushEnable(uid) {
      const { getMessaging, getToken, isSupported } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js');
      if (!(await isSupported()) || !VAPID_KEY) throw new Error('Notifications are not available on this device yet.');
      if ((await Notification.requestPermission()) !== 'granted') return false;
      const reg = await navigator.serviceWorker.ready;
      const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
      return true;
    },
  },

  optin: {
    watch: (uid, week, cb) => one(doc(db, 'optins', `${week}_${uid}`), cb),
    set: (uid, week, role, slots) => setDoc(doc(db, 'optins', `${week}_${uid}`), { uid, weekId: week, role, slots, createdAt: Date.now() }),
    clear: (uid, week) => deleteDoc(doc(db, 'optins', `${week}_${uid}`)),
  },

  openings: {
    watch: (uid, cb) => listen(query(collection(db, 'openings'), where('forUid', '==', uid)), cb),
    bid: (id, amount) => updateDoc(doc(db, 'openings', id), { bid: amount, bidAt: Date.now() }),
  },

  dates: {
    watch(uid, role, cb) {
      const c = collection(db, 'dates');
      return listen(role === 'woman'
        ? query(c, where('womanUid', '==', uid), where('status', 'in', WOMAN_VISIBLE))
        : query(c, where('manUid', '==', uid)), cb);
    },
    respond: (id, status, reason) => updateDoc(doc(db, 'dates', id), { status, respondedAt: Date.now(), ...(reason ? { declineReason: reason } : {}) }),
    arrived: (id, role) => updateDoc(doc(db, 'dates', id), { [role === 'woman' ? 'womanArrivedAt' : 'manArrivedAt']: Date.now() }),
    sos: (id, role) => updateDoc(doc(db, 'dates', id), { [role === 'woman' ? 'womanSos' : 'manSos']: Date.now() }),
  },

  payments: {
    watch: (uid, cb) => listen(query(collection(db, 'payments'), where('manUid', '==', uid)), cb),
    claim: (id, ref) => updateDoc(doc(db, 'payments', id), { status: 'claimed', claimedRef: ref, claimedAt: Date.now() }),
  },

  config: {
    async get() {
      try { const s = await getDoc(doc(db, 'config', 'app')); return { upiVpa: UPI.vpa, payee: UPI.payee, ...(s.exists() ? s.data() : {}) }; }
      catch { return { upiVpa: UPI.vpa, payee: UPI.payee }; }
    },
  },

  report: { create: data => addDoc(collection(db, 'reports'), { ...data, status: 'open', createdAt: Date.now() }) },

  admin: {
    applicants: cb => listen(query(collection(db, 'users'), where('status', 'in', ['pending', 'waitlist'])), cb),
    optins: (week, cb) => listen(query(collection(db, 'optins'), where('weekId', '==', week)), cb),
    async selfie(uid) { const s = await getDoc(doc(db, 'verifications', uid)); return s.exists() ? s.data().selfie : null; },
    async decide(uid, { status, verified, note }) {
      await updateDoc(doc(db, 'users', uid), { status, verified: !!verified, adminNote: note || '', decidedAt: Date.now() });
      if (status === 'approved' || status === 'rejected') await deleteDoc(doc(db, 'verifications', uid)).catch(() => {});
    },
    dates: cb => listen(collection(db, 'dates'), cb),
    release: id => updateDoc(doc(db, 'dates', id), { status: 'offered', releasedAt: Date.now() }),
    payments: cb => listen(collection(db, 'payments'), cb),
    async markPaid(id) {
      const b = writeBatch(db);
      b.update(doc(db, 'payments', id), { status: 'paid', paidAt: Date.now() });
      const d = await getDoc(doc(db, 'dates', id));
      if (d.exists() && d.data().status === 'pending_payment') b.update(doc(db, 'dates', id), { status: 'paid' });
      await b.commit();
    },
    settleDone: id => updateDoc(doc(db, 'payments', id), { 'settlement.done': true }),
    reports: cb => listen(collection(db, 'reports'), cb),
    resolveReport: id => updateDoc(doc(db, 'reports', id), { status: 'resolved', resolvedAt: Date.now() }),
  },
};
