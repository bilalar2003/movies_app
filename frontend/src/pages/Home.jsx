import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProtected, logout } from '../services/api'
import '../App.css'

function Home() {
  const navigate = useNavigate()
  const [movies, setMovies] = useState([])
  const [page, setPage] = useState(1)
  const [pageOffset, setPageOffset] = useState(0)
  const [pageLimit, setPageLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const scrollPositionRef = useRef(null)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
    navigate('/', { replace: true })
  }

  const changePage = (direction) => {
    scrollPositionRef.current = window.scrollY
    setPage((current) => current + direction)
  }

  useLayoutEffect(() => {
    if (scrollPositionRef.current !== null) {
      window.scrollTo(0, scrollPositionRef.current)
      scrollPositionRef.current = null
    }
  }, [movies])

  useEffect(() => {
    let isCurrent = true

    const loadMovies = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const response = await fetchProtected(`/api/movies?page=${page}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load movies')
        }

        if (isCurrent) {
          setMovies(data.movies)
          setPageOffset(data.offset)
          setPageLimit(data.limit)
          setTotalPages(data.totalPages)
        }
      } catch (error) { // this catches the error sent by refreshAccessToken() method if refreshToken is invalid. 
        if (isCurrent) {
          setErrorMessage(error.message)

          if (error.message === 'Session expired') {
            navigate('/', { replace: true }) // upon refreshToken expiration, user is redirected to login page. 
          }
        }
      } finally {
        if (isCurrent) {
          setLoading(false)
        }
      }
    }

    loadMovies()

    return () => {
      isCurrent = false
    }
  }, [navigate, page])

  return (
    <main className="movies-page">
      <section className="movies-shell">
        <header className="movies-header">
          <div>
            <p className="movies-kicker">MOVIES INN / LIBRARY</p>
            <h1>Find your next film.</h1>
            <p className="movies-intro">A curated shelf of stories, sorted for easy browsing.</p>
          </div>
          <div className="movies-header-actions">
            <span className="movies-count">10 per page</span>
            <button className="logout-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        </header>

        {loading && <p className="movies-state">Loading movies...</p>}
        {errorMessage && <p className="movies-state movies-state-error">{errorMessage}</p>}

        {!loading && !errorMessage && (
          <>
            <div className="movie-list" aria-label="Movie list">
              {movies.map((movie, index) => (
                <a className="movie-row" href={`/movies/${movie.id}`} key={movie.id}>
                  <span className="movie-number">{String(pageOffset + index + 1).padStart(2, '0')}</span>
                  <span className="movie-main">
                    <strong>{movie.title}</strong>
                    <span>{movie.genre || 'Genre unavailable'}</span>
                  </span>
                  <span className="movie-description">{movie.description}</span>
                  <span className="movie-meta">
                    <span>{movie.release_year}</span>
                    <span className="movie-rating">{Number(movie.rating).toFixed(1)}</span>
                  </span>
                </a>
              ))}
            </div>

            <nav className="movies-pagination" aria-label="Movie pages">
              <button type="button" disabled={page === 1} onClick={() => changePage(-1)}>
                Previous
              </button>
              <span>Page {page} of {totalPages} ({pageLimit} movies)</span>
              <button type="button" disabled={page === totalPages} onClick={() => changePage(1)}>
                Next
              </button>
            </nav>
          </>
        )}
      </section>
    </main>
  )
}

export default Home
