import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchProtected } from '../services/api'
import '../App.css'

function AdminMovie() {
  const { id } = useParams() // state variable to hold current movie id for which details displayed
  const navigate = useNavigate() // to navigate between pages 
  const [movie, setMovie] = useState(null) // state to hold movie information, fetched from DB 
  const [reviews, setReviews] = useState([]) // state to hold reviews of movie 
  const [loading, setLoading] = useState(true) // state to hold value for if movie details are loading
  const [errorMessage, setErrorMessage] = useState('') // same as before 

  // to scroll up to top of page when first accessed
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  // window is the browser’s global object,
  // representing the open page,
  // it holds things like the document, location, and history
  // scrollTo(x, y) scrolls page to given x & y coordinates.
  // 0,0 moves to top left of the page.

  useEffect(() => {
    let isCurrent = true // mark effect as active 

    const loadMovie = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const response = await fetchProtected(`/api/movies/${id}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load movie details')
        }

        if (isCurrent) { // if response OK, set data in states to display on page 
          setMovie(data.movie || data)
          setReviews(data.reviews || [])
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

    loadMovie()

    return () => {
      isCurrent = false
    }
  }, []) // effect runs once when page first mounts

  return (
    <main className="movie-page admin-page">
      <section className="movie-shell">
        <Link className="movie-back-link" to="/admin-home">&larr; Back to admin dashboard</Link>

        {loading && <p className="movies-state">Loading movie details...</p>}
        {errorMessage && <p className="movies-state movies-state-error">{errorMessage}</p>}

        {!loading && !errorMessage && movie && (
          <div className="movie-detail">
            <header className="movie-detail-header">
              <div>
                <p className="movies-kicker">ADMIN / MOVIE DETAILS</p>
                <h1>{movie.title}</h1>
              </div>
            </header>

            <article className="movie-description-panel">
              <p className="movie-panel-label">SYNOPSIS</p>
              <p className="movie-full-description">
                {movie.description || 'No synopsis is available for this movie yet.'}
              </p>
              <div className="movie-detail-meta">
                <div className="movie-detail-meta-item">
                  <span>Release year</span>
                  <strong>{movie.release_year || 'Year unavailable'}</strong>
                </div>
                <div className="movie-detail-meta-item">
                  <span>Genre</span>
                  <strong>{movie.genre || 'Genre unavailable'}</strong>
                </div>
                <div className="movie-detail-meta-item">
                  <span>IMDb rating</span>
                  <strong className="movie-rating">{Number(movie.rating || 0).toFixed(1)} / 10</strong>
                </div>
              </div>
            </article>

            <section className="profile-favorites" aria-labelledby="movie-reviews-heading">
              <div className="profile-section-heading">
                <div>
                  <p className="movie-panel-label">AUDIENCE REVIEWS</p>
                  <h2 id="movie-reviews-heading">Movie reviews</h2>
                </div>
                <span>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
              </div>

              {reviews.length === 0 ? (
                <p className="movies-state profile-empty-state">No reviews yet for this movie.</p>
              ) : (
                <div className="movie-list" aria-label="Movie reviews">
                  {reviews.map((review) => (
                    <div className="movie-row" key={review.review_id}>
                      <span className="movie-number review-rating">{review.user_rating}/5</span>
                      <span className="movie-main">
                        <strong>{review.user_name}</strong>
                        <span>{review.review}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  )
}

export default AdminMovie
