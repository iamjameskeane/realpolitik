import Link from "next/link";

export default function EventNotFound() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">Event Not Found</h1>
        <p className="text-slate-400 mb-8">
          This event may have been removed or the link is incorrect.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium transition-colors"
        >
          View Global Events →
        </Link>
      </div>
    </main>
  );
}
