import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProtected, logout } from '../services/api'
import '../App.css'

function AdminHome() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [movies, setMovies] = useState([])
  const [moviePage, setMoviePage] = useState(1)
  const [totalMoviePages, setTotalMoviePages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isCurrent = true

    const loadAdminData = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const [usersResponse, moviesResponse] = await Promise.all([
          fetchProtected('/api/admin/users'),
          fetchProtected(`/api/admin/movies?page=${moviePage}`),
        ])

        const usersData = await usersResponse.json()
        const moviesData = await moviesResponse.json()

        if (!usersResponse.ok) {
          throw new Error(usersData.message || 'Failed to load users')
        }

        if (!moviesResponse.ok) {
          throw new Error(moviesData.message || 'Failed to load movies')
        }

        if (isCurrent) {
          setUsers(usersData.users || [])
          setMovies(moviesData.movies || [])
          setTotalMoviePages(moviesData.totalPages || 1)
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
          setLoading(false)
        }
      }
    }

    loadAdminData()

    return () => {
      isCurrent = false
    }
  }, [moviePage, navigate])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <main className="movies-page admin-page">
      <section className="movies-shell">
        <header className="movies-header admin-header">
          <div>
            <p className="movies-kicker">ADMIN / CONTROL PANEL</p>
            <h1>Manage access.</h1>
            <p className="movies-intro">Users and movie inventory overview.</p>
          </div>
          <div className="movies-header-actions">
            <button type="button" className="logout-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        {loading && <p className="movies-state">Loading admin dashboard...</p>}
        {errorMessage && <p className="movies-state movies-state-error">{errorMessage}</p>}

        {!loading && !errorMessage && (
          <>
            <section className="profile-favorites admin-section" aria-labelledby="users-heading">
              <div className="profile-section-heading">
                <div>
                  <p className="movie-panel-label">USERS</p>
                  <h2 id="users-heading">Registered Users</h2>
                </div>
                <span>{users.length} {users.length === 1 ? 'user' : 'users'}</span>
              </div>

              {users.length === 0 ? (
                <p className="movies-state profile-empty-state">No users found.</p>
              ) : (
                <div className="movie-list" aria-label="Users list">
                  {users.map((user, index) => (
                    <div className="movie-row" key={user.id}>
                      <span className="movie-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="movie-main">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </span>
                      <span className="movie-description">{user.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="profile-favorites admin-section" aria-labelledby="movies-heading">
              <div className="profile-section-heading">
                <div>
                  <p className="movie-panel-label">MOVIES</p>
                  <h2 id="movies-heading">Movie Catalog</h2>
                </div>
                <span>{movies.length} {movies.length === 1 ? 'movie' : 'movies'}</span>
              </div>

              {movies.length === 0 ? (
                <p className="movies-state profile-empty-state">No movies found.</p>
              ) : (
                <>
                  <div className="movie-list" aria-label="Movies list">
                    {movies.map((movie, index) => (
                      <div className="movie-row" key={movie.id}>
                        <span className="movie-number">{String((moviePage - 1) * 10 + index + 1).padStart(2, '0')}</span>
                        <span className="movie-main">
                          <strong>{movie.title}</strong>
                          <span>{movie.genre || 'Genre unavailable'}</span>
                        </span>
                        <span className="movie-description">{movie.description}</span>
                        <span className="movie-meta">
                          <span>{movie.release_year}</span>
                          <span className="movie-rating">{Number(movie.rating || 0).toFixed(1)}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <nav className="movies-pagination" aria-label="Admin movie pages">
                    <button type="button" disabled={moviePage === 1} onClick={() => setMoviePage((current) => Math.max(1, current - 1))}>
                      Previous
                    </button>
                    <span>Page {moviePage} of {totalMoviePages}</span>
                    <button type="button" disabled={moviePage === totalMoviePages} onClick={() => setMoviePage((current) => Math.min(totalMoviePages, current + 1))}>
                      Next
                    </button>
                  </nav>
                </>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}

export default AdminHome
