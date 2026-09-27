import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [backendMessage, setBackendMessage] = useState(
    'Checking backend connection...'
  )

  useEffect(() => {
    const apiUrl =
      import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'

    fetch(`${apiUrl}/api/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Backend response was unsuccessful')
        }

        return response.json()
      })
      .then((data) => {
        setBackendMessage(data.message)
      })
      .catch(() => {
        setBackendMessage('Could not connect to the backend')
      })
  }, [])

  return (
    <main>
      <h1>Booking and Scheduling System</h1>
      <h2>React–Flask Connection</h2>
      <p>{backendMessage}</p>
    </main>
  )
}

export default App
