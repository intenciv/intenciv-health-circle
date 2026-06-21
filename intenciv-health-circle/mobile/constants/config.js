export const CONFIG = {
  API_URL:    process.env.EXPO_PUBLIC_API_URL    || 'https://intenciv-health-circle-production.up.railway.app',
  SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL || 'https://intenciv-health-circle-production.up.railway.app',
  WEBSITE_URL: process.env.EXPO_PUBLIC_WEBSITE_URL || 'https://www.intenciv.in',
  COMPANY: {
    name:    'IntenCiv Diagnostics',
    phones:  ['0141-6695038', '7399000299'],
    email:   'contact@intenciv.in',
    website: 'https://www.intenciv.in',
    city:    'Jaipur, Rajasthan, India',
  },
};
