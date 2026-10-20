import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchProtected } from '../services/api'
import '../App.css'

function Movie() {
    const { id } = useParams() // a react router hook, 
    // it returns object of dynamic URL params, 
    // like here: this movie page is accessed on frontend via 'movies/{:id}'
    // the :id is what this hook returns and stores in the id variable 
    const navigate = useNavigate() // hook to navigate between pages 
    const [movie, setMovie] = useState(null) // state to hold movie details object, returned from server 
    // default to null 
    const [reviews, setReviews] = useState([]) // state to hold all reviews the movie has, fetched from server and displayed
    // default to empty array 
    const [loading, setLoading] = useState(true) // state to show if movie details are being loaded or not
    // default to true 
    const [errorMessage, setErrorMessage] = useState('') // same as before. 
    const [reviewErrorMessage, setReviewErrorMessage] = useState('')
    const [rating, setRating] = useState(0) // state to hold rating set by user for the movie's review 
    const [review, setReview] = useState('') // state to hold review string entered by user in their review
    // default to empty 
    const [submittedReview, setSubmittedReview] = useState(null) // state to hold the success message,
    // returned after posting a review
    const [isSubmittingReview, setIsSubmittingReview] = useState(false) // tracks whether a review is currently being sent, 
    // to disable the submit button and prevent double submissions
    const apiPrefix = '/api/movies/'

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
        if (!submittedReview) { // if no success msg set in state,
            return undefined // exit effect early.
        } // actually all useEffects run once on first render (ie opening the page)
        //, this is a guard to prevent this effect trigger as no review has been submitted at the time 

        const timeoutId = setTimeout(() => {
            setSubmittedReview(null) // reset state value to null after 5s
        }, 5000) // 5000 is timer delay in ms, it's used to display the success msg for 5 seconds exactly

        return () => clearTimeout(timeoutId) //  
    }, [submittedReview]) // this useEffect runs when a review is submitted successfully
    // ie runs when submittedReview state's value updates 
    // note that if new value of state is same as old one, the effect won't run 

    useEffect(() => {
        if (!reviewErrorMessage) {
            return undefined
        }

        const timeoutId = setTimeout(() => {
            setReviewErrorMessage('')
        }, 5000)

        return () => clearTimeout(timeoutId)
    }, [reviewErrorMessage])

    useEffect(() => {
        let isCurrent = true  // flag to mark effect is in process

        const loadMovie = async () => { // method to load movie details 
            setLoading(true) // set loading state to true 
            setErrorMessage('')

            try {
                const response = await fetchProtected(`${apiPrefix}${id}`)
                const data = await response.json()

                if (!response.ok) { // throw error if response not 200 OK
                    throw new Error(data.message || 'Failed to load movie details')
                }

                if (isCurrent) { 
                // set movie details in states below
                    setMovie(data.movie || data)
                    setReviews(data.reviews || [])
                }
            } catch (error) { // this catch block runs when try block throws error
                if (isCurrent) { 
                    setErrorMessage(error.message)

                    if (error.message === 'Session expired') { // if refreshToken expired,
                        navigate('/', { replace: true }) // log user out 
                    }
                }
            } finally {
                if (isCurrent) { 
                    setLoading(false) // set loading state to false
                }
            }
        }

        loadMovie()

        return () => {
            isCurrent = false // set effect process as complete/inactive
        }
    }, [id, navigate]) // this effect re-runs on movie id change and accessing the page 

    const handleReviewSubmit = async (event) => {
        event.preventDefault() // prevent browser's default behavior to reload page upon form submission 

        if (!rating || !review.trim() || isSubmittingReview) {
            return // if no stars & review or a review already in submission, return 
        }

        setIsSubmittingReview(true) 
        setReviewErrorMessage('')
        setSubmittedReview(null)

        try {
            const response = await fetchProtected(`${apiPrefix}${id}/reviews`, {
                method: 'POST', // make POST api call to server with review data entered by user  
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
            setReviewErrorMessage(error.message)

            if (error.message === 'Session expired') {
                navigate('/', { replace: true })
            }
        } finally {
            setIsSubmittingReview(false) // mark review submission process as complete 
        }
    }

    return (
        <main className="movie-page">
            {submittedReview && ( // show success message of review submission if user submitted a review 
                <div className="alert alert-success review-success-notification" role="status" aria-live="polite">
                    {submittedReview}
                </div>
            )}
            {reviewErrorMessage && (
                <div className="alert alert-error review-error-notification" role="alert" aria-live="assertive">
                    {reviewErrorMessage}
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
                                <h1>{movie.title}</h1> {/* show movie title */}
                            </div>
                        </header>

                        <div className="movie-detail-grid">
                            <article className="movie-description-panel">
                                <p className="movie-panel-label">SYNOPSIS</p>
                                <p className="movie-full-description">
                                    {movie.description || 'No synopsis is available for this movie yet.'}
                                </p> {/* show movie desc, if not then show default msg set above  */}
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
                                            {[1, 2, 3, 4, 5].map((star) => ( // set stars for each number 
                                                <label key={star} className={star <= rating ? 'star-label star-label-active' : 'star-label'}>
                                                    <input
                                                        type="radio"
                                                        name="rating"
                                                        value={star}
                                                        checked={rating === star}
                                                        onChange={() => setRating(star)} // set rating state according to no. of stars chosen by user
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
                                        onChange={(event) => setReview(event.target.value)} // update review string upon user input 
                                        placeholder="What stayed with you?"
                                        rows="5"
                                        maxLength="1000"
                                        required
                                    />
                                    <button className="review-submit-button" type="submit" disabled={!rating || !review.trim() || isSubmittingReview}>
                                        {isSubmittingReview ? 'Submitting...' : 'Submit review'}
                                    </button> {/* as above, the button is disabled if a submit is already in process or stars & review arent both filled by user  */}
                                </form>
                            </section>
                        </div>

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
                                    {reviews.map((reviewItem) => ( // display all reviews of movie on page 
                                        <div className="movie-row" key={reviewItem.review_id}>
                                            <span className="movie-number review-rating">{reviewItem.user_rating}/5</span>
                                            <span className="movie-main">
                                                <strong>{reviewItem.user_name}</strong>
                                                <span>{reviewItem.review}</span>
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

export default Movie