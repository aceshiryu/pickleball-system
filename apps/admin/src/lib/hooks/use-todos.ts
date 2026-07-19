import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../api';

export interface Todo {
  id: string;
  title: string;
  description?: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

const TODOS_KEY = ['todos'] as const;

export function useTodos() {
  return useQuery({
    queryKey: TODOS_KEY,
    queryFn: async () => {
      const { data } = await api.get<Todo[]>('/todos');
      return data;
    },
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string }) => {
      const { data } = await api.post<Todo>('/todos', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TODOS_KEY }),
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Todo> & { id: string }) => {
      const { data } = await api.patch<Todo>(`/todos/${id}`, patch);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TODOS_KEY }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/todos/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TODOS_KEY }),
  });
}
