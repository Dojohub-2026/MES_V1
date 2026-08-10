import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mes_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// No response interceptor for 401s — when the 8h token expires, there's no
// automatic logout or redirect to the login screen. Each request that
// fails after expiry just surfaces as whatever error handling the calling
// component already has; the user stays "logged in" in the UI until they
// notice something isn't working and refresh or sign out manually.
