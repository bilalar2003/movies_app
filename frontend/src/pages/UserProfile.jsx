import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchProfile, updateFavorite } from '../services/api'
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
  const [favorites, setFavorites] = useState([])
  const [reviews, setReviews] = useState([])
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState(null)

  useEffect(() => {
    let isCurrent = true

    const loadProfile = async () => {
      try {
        const profile = await fetchProfile()
        if (isCurrent) {
          setUser(profile.user)
          setFavorites(profile.favorites)
          setReviews(profile.reviews || [])
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

  const handleFavoriteRemoval = async (movie) => {
    if (updatingFavoriteId === movie.id) {
      return
    }

    setUpdatingFavoriteId(movie.id)
    setErrorMessage('')

    try {
      await updateFavorite(movie.id, false)
      setFavorites((currentFavorites) => currentFavorites.filter(({ id }) => id !== movie.id))
    } catch (error) {
      setErrorMessage(error.message)
      if (error.message === 'Session expired') {
        navigate('/', { replace: true })
      }
    } finally {
      setUpdatingFavoriteId(null)
    }
  }

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

        {!isLoading && !errorMessage && user && (
          <>
            <section className="profile-favorites" aria-labelledby="favorites-heading">
              <div className="profile-section-heading">
                <div>
                  <p className="movie-panel-label">YOUR COLLECTION</p>
                  <h2 id="favorites-heading">Favorite movies</h2>
                </div>
                <span>{favorites.length} {favorites.length === 1 ? 'movie' : 'movies'}</span>
              </div>

              {favorites.length === 0 ? (
                <p className="movies-state profile-empty-state">You have not saved any favorite movies yet.</p>
              ) : (
                <div className="movie-list" aria-label="Favorite movies">
                  {favorites.map((movie, index) => (
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
                      <span className="movie-number">{String(index + 1).padStart(2, '0')}</span>
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
                        className="favorite-button favorite-button-active"
                        type="button"
                        aria-label={`Remove ${movie.title} from favorites`}
                        aria-pressed="true"
                        disabled={updatingFavoriteId === movie.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleFavoriteRemoval(movie)
                        }}
                      >
                        <span aria-hidden="true">&#9829;</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="profile-favorites" aria-labelledby="reviews-heading">
              <div className="profile-section-heading">
                <div>
                  <p className="movie-panel-label">YOUR REVIEWS</p>
                  <h2 id="reviews-heading">Movie reviews</h2>
                </div>
                <span>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
              </div>

              {reviews.length === 0 ? (
                <p className="movies-state profile-empty-state">You have not written any reviews yet.</p>
              ) : (
                <div className="movie-list" aria-label="User reviews">
                  {reviews.map((review) => (
                    <div className="movie-row" key={review.review_id}>
                      <span className="movie-number review-rating">{review.user_rating}/5</span>
                      <span className="movie-main">
                        <strong>{review.title}</strong>
                        <span>{review.genre || 'Genre unavailable'}</span>
                      </span>
                      <span className="movie-description">{review.review}</span>
                      <span className="movie-meta">
                        <span>{review.release_year}</span>
                        <span className="movie-rating">{Number(review.movie_rating).toFixed(1)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}

export default UserProfile
