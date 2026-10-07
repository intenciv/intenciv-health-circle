import { useState } from 'react';
import { PAYMENT } from '../../config/payment';

const BANK_FIELDS = [
  ['accountName',   'Account name'],
  ['bankName',      'Bank'],
  ['accountNumber', 'Account number'],
  ['ifsc',          'IFSC'],
  ['branch',        'Branch'],
  ['accountType',   'Account type'],
];

export default function SalespersonPayment() {
  const [copied, setCopied] = useState('');

  async function copy(key, text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      document.execCommand('copy'); document.body.removeChild(t);
    }
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  }

  async function shareQr() {
    try {
      const blob = await (await fetch(PAYMENT.qrImage)).blob();
      const file = new File([blob], 'intenciv-payment-qr.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'IntenCiv payment QR', text: `Pay to ${PAYMENT.payeeName} — UPI: ${PAYMENT.upiId}` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'IntenCiv payment', text: `Pay to ${PAYMENT.payeeName} — UPI: ${PAYMENT.upiId}` });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    copy('upi', PAYMENT.upiId);
  }

  const bank = BANK_FIELDS.filter(([k]) => PAYMENT[k]);

  return (
    <div className="col" style={{ gap: 18 }}>
      <h1>Company Payment</h1>

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{PAYMENT.payeeName}</div>
        <div style={{ color: 'var(--text-mid)', fontSize: 13, marginTop: 2 }}>Scan with any UPI app</div>
        <img
          src={PAYMENT.qrImage}
          alt={`UPI QR for ${PAYMENT.payeeName}`}
          style={{ width: '100%', maxWidth: 300, margin: '14px auto 6px', display: 'block', borderRadius: 8, background: '#fff' }}
        />
        <div className="mono" style={{ fontWeight: 600 }}>{PAYMENT.upiId}</div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={() => copy('upi', PAYMENT.upiId)}>{copied === 'upi' ? 'Copied ✓' : 'Copy UPI ID'}</button>
          <a href={PAYMENT.qrImage} download="intenciv-payment-qr.jpg">
            <button className="secondary" type="button">Download QR</button>
          </a>
          <button className="secondary" onClick={shareQr}>Share</button>
        </div>
      </div>

      {bank.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>Bank transfer details</h3>
          {bank.map(([k, label]) => (
            <div key={k} className="info-row" style={{ alignItems: 'center' }}>
              <span>{label}</span>
              <span className="row" style={{ gap: 8 }}>
                <span className="mono" style={{ fontWeight: 600 }}>{PAYMENT[k]}</span>
                <button className="secondary" style={{ height: 30, padding: '0 10px' }} onClick={() => copy(k, PAYMENT[k])}>
                  {copied === k ? '✓' : 'Copy'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {PAYMENT.note && <div className="card" style={{ color: 'var(--text-mid)', fontSize: 14 }}>{PAYMENT.note}</div>}
    </div>
  );
}
