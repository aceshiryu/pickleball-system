'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, getToken } from '../../lib/auth';
import {
  useTodos,
  useCreateTodo,
  useUpdateTodo,
  useDeleteTodo,
} from '../../lib/hooks/use-todos';

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');

  const todos = useTodos();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
  }, [router]);

  const handleSignOut = () => {
    clearToken();
    router.push('/login');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTodo.mutateAsync({ title });
    setTitle('');
  };

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Your todos</h1>
          <button
            onClick={handleSignOut}
            className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-white"
          >
            Sign out
          </button>
        </header>

        <form
          onSubmit={handleCreate}
          className="flex gap-2 bg-white p-4 rounded-2xl border border-gray-100"
        >
          <input
            type="text"
            placeholder="Add a new todo…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            disabled={createTodo.isPending}
            className="bg-black text-white px-4 rounded-lg disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <section className="space-y-2">
          {todos.isLoading && <p className="text-gray-500">Loading…</p>}
          {todos.isError && (
            <p className="text-red-600">Failed to load todos.</p>
          )}
          {todos.data?.length === 0 && (
            <p className="text-gray-500">No todos yet. Add one above.</p>
          )}
          {todos.data?.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-3 bg-white border border-gray-100 px-4 py-3 rounded-xl"
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() =>
                  updateTodo.mutate({
                    id: todo.id,
                    completed: !todo.completed,
                  })
                }
              />
              <span
                className={`flex-1 ${
                  todo.completed ? 'line-through text-gray-400' : ''
                }`}
              >
                {todo.title}
              </span>
              <button
                onClick={() => deleteTodo.mutate(todo.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
