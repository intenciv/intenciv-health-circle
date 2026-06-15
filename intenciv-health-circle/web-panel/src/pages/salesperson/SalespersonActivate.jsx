import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function SalespersonActivate() {
  const { cardId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: phone, 2: otp, 3: details+pin, 4: done
  const [phone, setPhone] = useState('');
  const [otp, setOtp]     = useState('');
  const [activationToken, setActivationToken] = useState('');
  const [name, setName]   = useState('');
  const [pin, setPin]     = useState('');
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  function fail(e, fallback) {
    const code = e.response?.data?.error;
    const map = {
      card_not_assigned_to_you: 'This card is not assigned to you.',
      card_not_activatable: 'This card cannot be activated (already active/expired).',
      invalid_phone: 'Enter a valid 10-digit mobile number.',
      otp_gateway_failed: 'Could not send OTP. Try again.',
      otp_not_found_or_expired: 'OTP expired. Please resend.',
      otp_attempts_exhausted: 'Too many incorrect attempts. Resend OTP.',
      otp_incorrect: `Incorrect OTP.${e.response?.data?.attempts_left != null ? ` ${e.response.data.attempts_left} attempts left.` : ''}`,
      pin_incorrect: 'Incorrect PIN.',
      card_already_activated: 'This card was already activated.',
      activation_token_invalid: 'Session expired — please verify OTP again.',
    };
    setErr(map[code] || fallback);
  }

  async function sendOtp(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      await api.post('/salesperson/activation/send-otp', { card_id: cardId, customer_phone: phone });
      setStep(2);
    } catch (e) { fail(e, 'Failed to send OTP.'); }
    finally { setLoading(false); }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const { data } = await api.post('/salesperson/activation/verify-otp', { card_id: cardId, customer_phone: phone, otp });
      setActivationToken(data.activation_token);
      setStep(3);
    } catch (e) { fail(e, 'OTP verification failed.'); }
    finally { setLoading(false); }
  }

  async function finalize(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const { data } = await api.post('/salesperson/activation/finalize', {
        card_id: cardId, customer_phone: phone, customer_name: name,
        activation_token: activationToken, pin,
      });
      setResult(data.card);
      setStep(4);
    } catch (e) { fail(e, 'Activation failed.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <h1>Activate Membership</h1>
      {err && <div className="error-banner">{err}</div>}

      {step === 1 && (
        <form onSubmit={sendOtp} className="card">
          <h3>Customer mobile number</h3>
          <p style={{ color: 'var(--text-mid)', marginTop: 4 }}>An OTP will be sent to verify this number.</p>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} type="tel" placeholder="9876543210" inputMode="numeric" autoFocus style={{ marginTop: 10 }} />
          <button type="submit" disabled={loading || phone.length !== 10} style={{ width: '100%', height: 48, marginTop: 14 }}>
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyOtp} className="card">
          <h3>Enter OTP</h3>
          <p style={{ color: 'var(--text-mid)', marginTop: 4 }}>Sent to +91 {phone}.</p>
          <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,8))} type="text" placeholder="OTP" inputMode="numeric" autoFocus style={{ marginTop: 10 }} />
          <button type="submit" disabled={loading || otp.length < 4} style={{ width: '100%', height: 48, marginTop: 14 }}>
            {loading ? 'Verifying…' : 'Verify OTP'}
          </button>
          <button type="button" className="secondary" onClick={() => { setStep(1); setOtp(''); setErr(''); }} style={{ width: '100%', height: 44, marginTop: 8 }}>
            Change number
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={finalize} className="card">
          <h3>Customer details</h3>
          <label className="label">Customer full name</label>
          <input value={name} onChange={e => setName(e.target.value)} type="text" placeholder="Full name" autoFocus />
          <div style={{ height: 12 }} />
          <label className="label">Your PIN (to confirm)</label>
          <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))} type="password" placeholder="••••" inputMode="numeric" />
          <button type="submit" disabled={loading || name.trim().length < 2 || pin.length !== 4} style={{ width: '100%', height: 48, marginTop: 14 }}>
            {loading ? 'Activating…' : 'Activate Membership'}
          </button>
        </form>
      )}

      {step === 4 && result && (
        <div className="card">
          <h3>Membership Activated ✅</h3>
          <div className="info-row"><span>Card</span><span className="mono">{result.card_number}</span></div>
          <div className="info-row"><span>Plan</span><span>{result.plan_name}</span></div>
          <div className="info-row"><span>Customer</span><span>{result.customer_name}</span></div>
          <div className="info-row"><span>Phone</span><span className="mono">{result.customer_phone}</span></div>
          <div className="info-row"><span>Amount paid</span><span>₹{Number(result.amount_paid).toLocaleString('en-IN')}</span></div>
          <div className="info-row"><span>Expires</span><span>{new Date(result.expires_at).toLocaleDateString()}</span></div>
          <div className="info-row"><span>Coupons issued</span><span>{result.total_coupons}</span></div>
          <button onClick={() => navigate('/salesperson/cards')} style={{ width: '100%', height: 48, marginTop: 14 }}>
            Back to My Cards
          </button>
        </div>
      )}
    </div>
  );
}
