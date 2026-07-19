import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          pickleball
        </h1>
        <p className="text-lg text-gray-600">
          A full-stack starter built with Nx, NestJS, Next.js, TypeORM, and
          PostgreSQL. Ready to ship.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Link
            href="/login"
            className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800"
          >
            Sign in
          </Link>
          <a
            href="http://localhost:3001/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-100"
          >
            API docs
          </a>
        </div>
      </div>
    </main>
  );
}
