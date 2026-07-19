import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { setToken } from '../auth';

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<AuthResponse>('/auth/login', payload);
      return data;
    },
    onSuccess: (data) => {
      setToken(data.accessToken);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<AuthResponse>('/auth/register', payload);
      return data;
    },
    onSuccess: (data) => {
      setToken(data.accessToken);
    },
  });
}
