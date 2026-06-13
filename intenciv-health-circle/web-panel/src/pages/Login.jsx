import OtpLogin from '../components/OtpLogin.jsx';

export default function Login() {
  return (
    <OtpLogin
      expectedRole="receptionist"
      title="IntenCiv Reception"
      subtitle="Sign in to look up and avail patient coupons."
      redirectTo="/reception"
    />
  );
}
