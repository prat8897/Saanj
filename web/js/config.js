// 1. Create a Firebase project, add a Web app, paste its config below.
// 2. Until you do, the app runs in DEMO mode (in-memory data, a scenario switcher) so you can see every screen.
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Web push certificate key (Firebase console > Project settings > Cloud Messaging > Web Push certificates). Optional.
export const VAPID_KEY = '';

// Used when the engine has no Razorpay keys: the man pays by UPI and an admin confirms it.
export const UPI = { vpa: 'yourname@upi', payee: 'Saanj' };

export const DEMO = new URLSearchParams(location.search).has('demo') || firebaseConfig.apiKey.startsWith('YOUR_');
