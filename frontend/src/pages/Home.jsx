import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProtected, logout, updateFavorite } from '../services/api'
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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState(null)
  const scrollPositionRef = useRef(null)
  const profileMenuRef = useRef(null)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
    navigate('/', { replace: true })
  }

  const changePage = (direction) => {
    scrollPositionRef.current = window.scrollY
    setPage((current) => current + direction)
  }

  const handleFavoriteToggle = async (event, movie) => {
    event.stopPropagation()

    if (updatingFavoriteId === movie.id) {
      return
    }

    setUpdatingFavoriteId(movie.id)
    setErrorMessage('')

    try {
      const isFavorite = await updateFavorite(movie.id, !movie.is_favorite)
      setMovies((currentMovies) => currentMovies.map((currentMovie) => (
        currentMovie.id === movie.id
          ? { ...currentMovie, is_favorite: isFavorite }
          : currentMovie
      )))
    } catch (error) {
      setErrorMessage(error.message)
      if (error.message === 'Session expired') {
        navigate('/', { replace: true })
      }
    } finally {
      setUpdatingFavoriteId(null)
    }
  }

  useEffect(() => {
    const closeProfileMenu = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', closeProfileMenu)
    return () => document.removeEventListener('mousedown', closeProfileMenu)
  }, [])

  useLayoutEffect(() => {
    if (scrollPositionRef.current !== null) {
      window.scrollTo(0, scrollPositionRef.current)
      scrollPositionRef.current = null
    }
  }, [movies])

  useEffect(() => { // this useEffect() runs when Home.jsx page is accessed.
    let isCurrent = true

    const loadMovies = async () => {
      setLoading(true)
      setErrorMessage('')

      try { // this page in turn calls fetchProtected API for retreiving the movies list
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
            <div className="profile-menu" ref={profileMenuRef}>
              <button
                className="profile-button"
                type="button"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                aria-label="Open profile menu"
                onClick={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
              >
                <span className="profile-icon" aria-hidden="true">&#128100;</span>
              </button>
              {isProfileMenuOpen && (
                <div className="profile-dropdown" role="menu">
                  <button type="button" role="menuitem" onClick={() => navigate('/profile')}>
                    View Profile
                  </button>
                  <button type="button" role="menuitem" onClick={handleLogout} disabled={isLoggingOut}>
                    {isLoggingOut ? 'Logging out...' : 'Log Out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {loading && <p className="movies-state">Loading movies...</p>}
        {errorMessage && <p className="movies-state movies-state-error">{errorMessage}</p>}

        {!loading && !errorMessage && (
          <>
            <div className="movie-list" aria-label="Movie list">
              {movies.map((movie, index) => (
                <div
                  className="movie-row"
                  key={movie.id}
                  role="link"
                  tabIndex="0"
                  onClick={() => navigate(`/movies/${movie.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(`/movies/${movie.id}`)
                    }
                  }}
                >
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
                  <button
                    className={movie.is_favorite ? 'favorite-button favorite-button-active' : 'favorite-button'}
                    type="button"
                    aria-label={movie.is_favorite ? `Remove ${movie.title} from favorites` : `Add ${movie.title} to favorites`}
                    aria-pressed={movie.is_favorite}
                    disabled={updatingFavoriteId === movie.id}
                    onClick={(event) => handleFavoriteToggle(event, movie)}
                  >
                    <span aria-hidden="true">{movie.is_favorite ? '\u2665' : '\u2661'}</span>
                  </button>
                </div>
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
