// Halaman login. Frontend murni: tidak menyentuh backend/, cuma menautkan ke
// route handler yang mengurus OAuth.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Catet!</h1>
      {error && <p className="text-sm text-red-600">Login gagal: {error}</p>}
      <a
        href="/api/auth/signin"
        className="rounded-md border border-black/15 px-5 py-2.5 text-sm font-medium hover:bg-black/5"
      >
        Masuk dengan Google
      </a>
    </main>
  );
}
