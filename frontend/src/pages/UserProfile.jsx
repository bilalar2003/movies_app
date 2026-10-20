import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchProfile, updateFavorite } from '../services/api'
import '../App.css'

function UserProfile() {
  const navigate = useNavigate() // react hook for navigating between pages
  const [user, setUser] = useState(() => { // state to hold user details,
    try { // the callback is called when page loads, so details are stored in the state variable 
      return JSON.parse(localStorage.getItem('currentUser')) // this retrieves user details from browser storage
      // parses and stores it in state 
    } catch { 
      return null
    }
  })
  const [errorMessage, setErrorMessage] = useState('') // same
  const [isLoading, setIsLoading] = useState(!user) // if user null, set isloading to true, else false
  const [favorites, setFavorites] = useState([]) // state to load and display favourite movies of user 
  const [reviews, setReviews] = useState([]) // state to load and display movie revies of user
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState(null) // state to hold id of movie clicked to be faved

  
  useEffect(() => {
    let isCurrent = true // flag to indicate useEffect is in running

    const loadProfile = async () => {
      try {
        const profile = await fetchProfile() // api call to fetch user profile 
        if (isCurrent) { // if running, run below code to update state values
          setUser(profile.user) // set user state to user returned from server
          setFavorites(profile.favorites) // same as above
          setReviews(profile.reviews || []) // same, if no reviews then set it empty 
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(error.message)
          if (error.message === 'Session expired') { // if refreshToken expired, log out
            navigate('/', { replace: true })
          }
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false) // sets isloading state to false, ie info is loaded 
        }
      }
    }

    loadProfile()

    return () => {
      isCurrent = false// mark useEffect as complete 
    }
  }, [navigate]) // the useEffect runs when we access this page 

  const handleFavoriteRemoval = async (movie) => {
    if (updatingFavoriteId === movie.id) { // guard for checking if movie fave update is already in process,
      return // ignoring repeated clicks 
    }
    setUpdatingFavoriteId(movie.id) // set id of movie that is being faved 
    try {
      await updateFavorite(movie.id, false) // update movie as unfave 
      setFavorites((currentFavorites) => currentFavorites.filter(({ id }) => id !== movie.id))
      // this filters out the movies that were unfaved by user upon clicking the heart icon 
    } catch (error) {
      setErrorMessage(error.message)
      if (error.message === 'Session expired') { // if refreshToken expired, log user out 
        navigate('/', { replace: true })
      }
    } finally {
      setUpdatingFavoriteId(null) // update complete, reset updating id state to null 
    }
  }

  // to scroll up to top of page when first accessed
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  // window is the browser’s global object,
  // representing the open page,
  // it holds things like the document, location, and history
  // scrollTo(x, y) scrolls page to given x & y coordinates.
  // 0,0 moves to top left of the page.

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

      {/* Below code displays user details once details have been fetched from the DB */}
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
                  {favorites.map((movie, index) => ( // map all movie favourites on display 
                    <div
                      className="movie-row"
                      key={movie.id}
                      role="link"
                      tabIndex="0"
                      onClick={() => navigate(`/movies/${movie.id}`)}
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
                          // removing a favorite doesn’t also,
                          // trigger the row’s onClick that navigates to the movie page
                          handleFavoriteRemoval(movie)
                        }} // this triggers event listener for removing movie as fave 
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
                  {reviews.map((review) => ( // map all reviews on display
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
