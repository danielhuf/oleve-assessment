import axios from 'axios';
import { Prompt, Pin, PinStatus } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const promptService = {
  // Create a new prompt
  createPrompt: async (text: string): Promise<Prompt> => {
    const response = await api.post('/api/prompts/', { text });
    return response.data;
  },

  // Get all prompts
  getPrompts: async (): Promise<Prompt[]> => {
    const response = await api.get('/api/prompts/');
    return response.data;
  },

  // Get a specific prompt
  getPrompt: async (id: string): Promise<Prompt> => {
    const response = await api.get(`/api/prompts/${id}`);
    return response.data;
  },

  // Start Pinterest workflow
  startWorkflow: async (promptId: string): Promise<{ message: string; prompt_id: string; status: string }> => {
    const response = await api.post(`/api/prompts/${promptId}/start-workflow`);
    return response.data;
  },

  // Start AI validation
  startValidation: async (promptId: string): Promise<{ message: string; prompt_id: string; pending_pins: number; status: string }> => {
    const response = await api.post(`/api/prompts/${promptId}/validate`);
    return response.data;
  },

  // Get sessions for a prompt
  getSessions: async (promptId: string): Promise<any[]> => {
    const response = await api.get(`/api/prompts/${promptId}/sessions`);
    return response.data;
  },

  // Get pins for a prompt
  getPins: async (promptId: string, status?: PinStatus): Promise<Pin[]> => {
    const params = status && status !== 'all' ? { status } : {};
    const response = await api.get(`/api/prompts/${promptId}/pins`, { params });
    return response.data;
  },

  // Delete a prompt
  deletePrompt: async (id: string): Promise<void> => {
    await api.delete(`/api/prompts/${id}`);
  },
};

export default api; 