import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

function AdminPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3ec] p-6">
      <section className="w-full max-w-lg rounded-3xl bg-white p-10 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#567058]">
          Administrator access
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Administrator dashboard
        </h1>

        <p className="mt-4 text-muted-foreground">
          Only active administrators can open this page.
        </p>

        <Button className="mt-8" asChild>
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </section>
    </main>
  )
}

export default AdminPage