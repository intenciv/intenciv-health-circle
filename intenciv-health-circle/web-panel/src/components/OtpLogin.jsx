import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';

/**
 * Shared OTP login screen used by Receptionist (/login) and Admin
 * (/admin/login). The expected role is enforced after verification.
 */
export default function OtpLogin({ expectedRole, title, subtitle, redirectTo }) {
  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState(['', '', '', '']);
  const [step, setStep]         = useState('phone'); // 'phone' | 'otp'
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputsRef = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function sendOtp() {
    setError('');
    if (!/^\+?\d{10,13}$/.test(phone.replace(/\s/g, ''))) {
      setError('Enter a valid Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone });
      setStep('otp');
      setCountdown(60);
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  function setOtpDigit(i, v) {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp]; next[i] = v;
    setOtp(next);
    if (v && i < 3) inputsRef.current[i + 1]?.focus();
    if (i === 3 && v) verifyOtp(next.join(''));
  }

  async function verifyOtp(code) {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp: code });
      if (data.user.role !== expectedRole) {
        setError(`This portal is for ${expectedRole.replace('_', ' ')} accounts only.`);
        tokens.clear();
        return;
      }
      tokens.setSession(data);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(e.response?.data?.error || 'Verification failed');
      setOtp(['', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-page">
      <div className="login-card">
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>

        {error && <div className="error-banner">{error}</div>}

        {step === 'phone' && (
          <>
            <label className="label">Mobile number</label>
            <input
              placeholder="+91 98765 43210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoFocus
            />
            <div style={{ height: 16 }} />
            <button onClick={sendOtp} disabled={loading} style={{ width: '100%', height: 48 }}>
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <label className="label">Enter the 4-digit OTP sent to {phone}</label>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '8px 0 16px' }}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => (inputsRef.current[i] = el)}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => setOtpDigit(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0) inputsRef.current[i - 1]?.focus();
                  }}
                  style={{ width: 56, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700 }}
                />
              ))}
            </div>
            <button
              className="ghost"
              disabled={countdown > 0 || loading}
              onClick={sendOtp}
              style={{ width: '100%' }}
            >
              {countdown > 0
                ? `Resend OTP in 0:${String(countdown).padStart(2, '0')}`
                : 'Resend OTP'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
