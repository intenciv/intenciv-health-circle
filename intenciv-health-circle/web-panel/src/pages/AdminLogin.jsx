import OtpLogin from '../components/OtpLogin.jsx';

export default function AdminLogin() {
  return (
    <OtpLogin
      expectedRole="admin"
      title="IntenCiv Admin"
      subtitle="Operations dashboard — tiers, codes, agents, reports."
      redirectTo="/admin/dashboard"
    />
  );
}
