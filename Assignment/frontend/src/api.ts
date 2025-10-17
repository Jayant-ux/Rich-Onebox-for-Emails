import axios from 'axios';

const api = axios.create({ baseURL: (import.meta as any).env.VITE_API_BASE || 'http://localhost:4000/api' });

export async function searchEmails(params: { q?: string; accountId?: string; folder?: string; category?: string }) {
  const res = await api.get('/emails', { params });
  return res.data.results as any[];
}

export async function setCategory(id: string, category: string, subject: string, from: string) {
  await api.post(`/emails/${encodeURIComponent(id)}/category`, { category, subject, from });
}

export async function getSuggestedReply(email: string, responseType: string = 'professional') {
  const res = await api.post('/emails/suggest-reply', { email, responseType });
  return res.data.reply as string;
}


