// Optional Razorpay Payment Links. If RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set this returns
// null and the app falls back to a UPI deep link plus manual confirmation in the admin screen.
export function makePay(env = process.env) {
  const id = env.RAZORPAY_KEY_ID, secret = env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) return null;
  const auth = 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
  const call = async (path, init = {}) => {
    const r = await fetch('https://api.razorpay.com/v1' + path, { ...init, headers: { Authorization: auth, 'Content-Type': 'application/json' } });
    const j = await r.json();
    if (!r.ok) throw new Error(`razorpay ${path}: ${j.error?.description || r.status}`);
    return j;
  };
  return {
    async createLink({ amountInr, ref, name, email, expireBy }) {
      const j = await call('/payment_links', {
        method: 'POST',
        body: JSON.stringify({
          amount: amountInr * 100, currency: 'INR', accept_partial: false, reference_id: ref,
          description: 'Saanj: your evening',
          customer: { name, email }, notify: { email: !!email }, reminder_enable: false,
          expire_by: Math.max(expireBy, Math.floor(Date.now() / 1000) + 20 * 60),
        }),
      });
      return { id: j.id, url: j.short_url };
    },
    async status(linkId) { return (await call('/payment_links/' + linkId)).status; },
  };
}
