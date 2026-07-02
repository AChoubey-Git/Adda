import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 30000,
});

// Request: attach access token
api.interceptors.request.use((config) => {
  // Dynamically read from store to avoid stale closure
  // Wrapped in try/catch: Safari Private Browsing throws SecurityError on localStorage
  try {
    const stored = localStorage.getItem('adda-auth');
    if (stored) {
      const { state } = JSON.parse(stored);
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    }
  } catch {}
  return config;
});

// Response: handle 401 with token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      // Wrapped in try/catch: Safari Private Browsing throws SecurityError on localStorage
      let stored = null;
      try { stored = localStorage.getItem('adda-auth'); } catch {}
      const refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null;

      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });

        // Update stored tokens
        const parsed = JSON.parse(stored);
        parsed.state.accessToken = data.accessToken;
        parsed.state.refreshToken = data.refreshToken;
        localStorage.setItem('adda-auth', JSON.stringify(parsed));

        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        // Clear auth state
        localStorage.removeItem('adda-auth');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
