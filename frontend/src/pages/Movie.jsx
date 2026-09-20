import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchProtected } from '../services/api'
import '../App.css'

function Movie() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [movie, setMovie] = useState(null)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')
    const [rating, setRating] = useState(0)
    const [review, setReview] = useState('')
    const [submittedReview, setSubmittedReview] = useState(null)
    const [isSubmittingReview, setIsSubmittingReview] = useState(false)

    useEffect(() => {
        if (!submittedReview) {
            return undefined
        }

        const timeoutId = setTimeout(() => {
            setSubmittedReview(null)
        }, 5000)

        return () => clearTimeout(timeoutId)
    }, [submittedReview])

    useEffect(() => {
        let isCurrent = true

        const loadMovie = async () => {
            setLoading(true)
            setErrorMessage('')

            try {
                const response = await fetchProtected(`/api/movies/${id}`)
                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to load movie details')
                }

                if (isCurrent) {
                    setMovie(data.movie || data)
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
    }, [id, navigate])

    const handleReviewSubmit = async (event) => {
        event.preventDefault()

        if (!rating || !review.trim() || isSubmittingReview) {
            return
        }

        setIsSubmittingReview(true)
        setErrorMessage('')

        try {
            const response = await fetchProtected(`/api/movies/${id}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rating,
                    review: review.trim(),
                }),
            })
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Failed to submit review')
            }

            setSubmittedReview(data.message)
            setRating(0)
            setReview('')
        } catch (error) {
            setErrorMessage(error.message)

            if (error.message === 'Session expired') {
                navigate('/', { replace: true })
            }
        } finally {
            setIsSubmittingReview(false)
        }
    }

    return (
        <main className="movie-page">
            {submittedReview && (
                <div className="alert alert-success review-success-notification" role="status" aria-live="polite">
                    {submittedReview}
                </div>
            )}

            <section className="movie-shell">
                <Link className="movie-back-link" to="/home">&larr; Back to library</Link>

                {loading && <p className="movies-state">Loading movie details...</p>}
                {errorMessage && <p className="movies-state movies-state-error">{errorMessage}</p>}

                {!loading && !errorMessage && movie && (
                    <div className="movie-detail">
                        <header className="movie-detail-header">
                            <div>
                                <p className="movies-kicker">NOW PLAYING / FEATURE</p>
                                <h1>{movie.title}</h1>
                            </div>
                        </header>

                        <div className="movie-detail-grid">
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

                            <section className="review-panel" aria-labelledby="review-heading">
                                <p className="movie-panel-label">YOUR TAKE</p>
                                <h2 id="review-heading">Leave a review</h2>
                                <form onSubmit={handleReviewSubmit} className="review-form">
                                    <fieldset>
                                        <legend>Rating</legend>
                                        <div className="star-rating" aria-label="Choose a rating out of five stars">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <label key={star} className={star <= rating ? 'star-label star-label-active' : 'star-label'}>
                                                    <input
                                                        type="radio"
                                                        name="rating"
                                                        value={star}
                                                        checked={rating === star}
                                                        onChange={() => setRating(star)}
                                                    />
                                                    <span aria-hidden="true">&#9733;</span>
                                                    <span className="sr-only">{star} {star === 1 ? 'star' : 'stars'}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>

                                    <label className="review-input-label" htmlFor="movie-review">Review</label>
                                    <textarea
                                        id="movie-review"
                                        value={review}
                                        onChange={(event) => setReview(event.target.value)}
                                        placeholder="What stayed with you?"
                                        rows="5"
                                        maxLength="1000"
                                        required
                                    />
                                    <button className="review-submit-button" type="submit" disabled={!rating || !review.trim() || isSubmittingReview}>
                                        {isSubmittingReview ? 'Submitting...' : 'Submit review'}
                                    </button>
                                </form>

                            </section>
                        </div>
                    </div>
                )}
            </section>
        </main>
    )
}

export default Movie