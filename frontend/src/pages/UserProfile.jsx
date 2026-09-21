import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchProfile } from '../services/api'
import '../App.css'

function UserProfile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('currentUser'))
    } catch {
      return null
    }
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(!user)

  useEffect(() => {
    let isCurrent = true

    const loadProfile = async () => {
      try {
        const profile = await fetchProfile()
        if (isCurrent) {
          setUser(profile)
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(error.message)
          if (error.message === 'Session expired') {
            navigate('/', { replace: true })
          }
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isCurrent = false
    }
  }, [navigate])

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <Link className="movie-back-link" to="/home">&larr; Back to library</Link>

        <header className="profile-header">
          <div>
            <p className="movies-kicker">MOVIES INN / ACCOUNT</p>
            <h1>Your profile.</h1>
            <p className="movies-intro">Your account details, kept in one quiet place.</p>
          </div>
          <div className="profile-avatar" aria-hidden="true">{user?.name?.charAt(0).toUpperCase() || 'M'}</div>
        </header>

        {isLoading && <p className="movies-state">Loading profile...</p>}
        {errorMessage && <p className="movies-state movies-state-error">{errorMessage}</p>}

        {!isLoading && !errorMessage && user && (
          <section className="profile-card" aria-label="User information">
            <p className="movie-panel-label">ACCOUNT DETAILS</p>
            <div className="profile-details">
              <div className="profile-detail">
                <span>Name</span>
                <strong>{user.name}</strong>
              </div>
              <div className="profile-detail">
                <span>Email</span>
                <strong>{user.email}</strong>
              </div>
              <div className="profile-detail">
                <span>Role</span>
                <strong className="profile-role">{user.role}</strong>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default UserProfile
