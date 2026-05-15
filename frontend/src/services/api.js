import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

export const submissions = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/submissions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getStatus: (id) => api.get(`/submissions/${id}/status`),
  getUserSubmissions: () => api.get('/submissions/user'),
  runTest: (id, botCount, duration) => api.post(`/test/${id}`, { botCount, duration }),
};

export const leaderboard = {
  get: () => api.get('/leaderboard'),
};

export default api;