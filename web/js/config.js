// 1. Create a Firebase project, add a Web app, paste its config below.
// 2. With a placeholder apiKey (YOUR_...) the app runs in DEMO mode (in-memory data, a scenario switcher) so you can see every screen.
export const firebaseConfig = {
  apiKey: 'AIzaSyAF1l9CiYZLtZ-1I6xEDYbCAefs_Nl-xIM', // public client key; access is enforced by firestore.rules
  authDomain: 'saanj-a27ee.firebaseapp.com',
  projectId: 'saanj-a27ee',
  storageBucket: 'saanj-a27ee.firebasestorage.app',
  messagingSenderId: '608819384819',
  appId: '1:608819384819:web:7e0861fbf529cd19ae4286',
};

// Web push certificate key (Firebase console > Project settings > Cloud Messaging > Web Push certificates). Optional.
export const VAPID_KEY = '';

// Used when the engine has no Razorpay keys: the man pays by UPI and an admin confirms it.
export const UPI = { vpa: 'yourname@upi', payee: 'Saanj' };

export const DEMO = new URLSearchParams(location.search).has('demo') || firebaseConfig.apiKey.startsWith('YOUR_');
