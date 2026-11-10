import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Building2, LoaderCircle, MapPin } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

function ResourcesPage() {
    const { isAdmin } = useAuth()

    const [resources, setResources] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [reloadCount, setReloadCount] = useState(0)

    useEffect(() => {
        let active = true

        apiRequest('/api/resources')
            .then((result) => {
                if (!Array.isArray(result.resources)) {
                    throw new Error('The server returned an invalid resource list.')
                }

                if (active) {
                    setResources(result.resources)
                }
            })
            .catch((requestError) => {
                if (active) {
                    setError(
                        requestError.message || 'Unable to load resources.'
                    )
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [reloadCount])

    function refreshResources() {
        setError('')
        setLoading(true)
        setReloadCount((count) => count + 1)
    }

    return (
        <main className="min-h-screen bg-[#eef3ec] p-6 sm:p-10">
            <div className="mx-auto max-w-5xl">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wider text-[#567058]">
                            Booking & Scheduling
                        </p>

                        <h1 className="mt-2 text-3xl font-bold">
                            Browse resources
                        </h1>

                        <p className="mt-3 text-muted-foreground">
                            Explore the rooms and resources available for booking.
                        </p>
                    </div>

                    <Button variant="outline" asChild>
                        <Link to={isAdmin ? '/admin' : '/dashboard'}>
                            Back to dashboard
                        </Link>
                    </Button>
                </header>

                <div className="mt-8 flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold">
                        Active resources
                    </h2>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={refreshResources}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                </div>

                {loading ? (
                    <div
                        role="status"
                        className="mt-6 flex items-center gap-3 rounded-2xl bg-white p-8"
                    >
                        <LoaderCircle className="size-5 animate-spin" />
                        <p>Loading resources...</p>
                    </div>
                ) : error ? (
                    <div
                        role="alert"
                        className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"
                    >
                        {error}
                    </div>
                ) : resources.length === 0 ? (
                    <div className="mt-6 rounded-2xl bg-white p-8">
                        <p>No active resources are available yet.</p>
                    </div>
                ) : (
                    <section
                        aria-label="Available resources"
                        className="mt-6 grid gap-6 md:grid-cols-2"
                    >
                        {resources.map((resource) => (
                            <article
                                key={resource.id}
                                className="rounded-3xl bg-white p-8 shadow-sm"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="rounded-2xl bg-[#e2ebe0] p-3 text-[#4e684f]">
                                        <Building2 className="size-6" />
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold">
                                            {resource.name}
                                        </h3>

                                        <p className="mt-1 text-sm text-[#567058]">
                                            {resource.location?.name}
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-5 text-muted-foreground">
                                    {resource.description || 'No description provided.'}
                                </p>

                                {resource.location?.address && (
                                    <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
                                        <MapPin className="mt-0.5 size-4 shrink-0" />
                                        {resource.location.address}
                                    </p>
                                )}
                                <Button
                                    className="mt-6 bg-[#4f654d] text-white hover:bg-[#3f523e]"
                                    asChild
                                >
                                    <Link to={`/resources/${resource.id}/slots`}>
                                        View time slots
                                    </Link>
                                </Button>
                            </article>
                        ))}
                    </section>
                )}
            </div>
        </main>
    )
}

export default ResourcesPage