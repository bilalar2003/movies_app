import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProtected, logout } from '../services/api'
import '../App.css'

function AdminHome() {
  const navigate = useNavigate() // to navigate between pages
  const [users, setUsers] = useState([]) // state to hold all user rows registered in the app (fetched from DB)
  const [movies, setMovies] = useState([]) // state to hold all movie rows in DB
  const [reviews, setReviews] = useState([]) // state to hold all movie reviews in DB
  const [moviePage, setMoviePage] = useState(1) // state to hold current page number for 
  const [totalMoviePages, setTotalMoviePages] = useState(1) // state to hold total pages needed to display all movie rows
  const [loading, setLoading] = useState(true) // same as before 
  const [errorMessage, setErrorMessage] = useState('') // same as before 
  const scrollPositionRef = useRef(null) // ref to hold current scroll position 

  const apiPrefix = '/api/'
  const adminPrefix = 'admin/'

  useLayoutEffect(() => { // this runs when movies state changes,
      // meaning when user navigates between pages, and new movies are loaded.
    if (scrollPositionRef.current !== null) { // checks if scroll ref holds any value. 
      window.scrollTo(0, scrollPositionRef.current)
      // above, window is browser window object,
      // scrollTo() scrolls the window to the specified position,
      // first argument is x-coordinate (horizontal), second is y-coordinate (vertical),
      // here, it scrolls to the position stored in scrollPositionRef.current,
      // which was set when user clicked next/previous page button.
      scrollPositionRef.current = null // after scrolling, scrollPositionRef is reset to null,
      // so that it doesn't affect future page navigations.
    }
  }, [movies]) 

  // to scroll up to top of page when first accessed
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  // window is the browser’s global object,
  // representing the open page,
  // it holds things like the document, location, and history
  // scrollTo(x, y) scrolls page to given x & y coordinates.
  // 0,0 moves to top left of the page.

  useEffect(() => { // effect runs 
    let isCurrent = true // mark effect as active 

    const loadAdminData = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const [usersResponse, moviesResponse, reviewsResponse] = await Promise.all([
          fetchProtected(`${apiPrefix}${adminPrefix}users`),
          fetchProtected(`${apiPrefix}movies?page=${moviePage}`),
          fetchProtected(`${apiPrefix}${adminPrefix}reviews`),
        ]) // promise.all runs both promises together, returning 
        // their result in same order as the array 

        const usersData = await usersResponse.json()
        const moviesData = await moviesResponse.json()
        const reviewsData = await reviewsResponse.json() // parse both users and reviews data

        if (!usersResponse.ok) {
          throw new Error(usersData.message || 'Failed to load users')
        }

        if (!moviesResponse.ok) {
          throw new Error(moviesData.message || 'Failed to load movies')
        }

        if (!reviewsResponse.ok) {
          throw new Error(reviewsData.message || 'Failed to load reviews')
        }

        if (isCurrent) { // if effect active, set data in state variables below 
          setUsers(usersData.users || [])
          setMovies(moviesData.movies || [])
          setTotalMoviePages(moviesData.totalPages || 1)
          setReviews(reviewsData.reviews || [])
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
      isCurrent = false // mark effect as inactive 
    }
  }, [moviePage, navigate]) // effect runs 

  const changeMoviePage = (direction) => { // eventListener function, runs upon page change click. direction is parameter,
    // that holds values -1 or 1, respecitvely indicating to move to prev. & next page. 
    scrollPositionRef.current = window.scrollY // save the vertical scroll position of page into the ref. value
    setMoviePage((current) => current + direction) // update page state variable to new page number
  }
  const handleLogout = async () => { // event listener for logging out admin.
    await logout() // wait for logout endpoint to be processed
    navigate('/', { replace: true }) // replace existing top entry in browser history stack with this entry.
  }

  return (
    <main className="movies-page admin-page">
      <section className="movies-shell">
        <header className="movies-header admin-header">
          <div>
            <p className="movies-kicker">ADMIN / CONTROL PANEL</p>
            <h1>Manage access.</h1>
            <p className="movies-intro">Users, movie inventory, and submitted reviews.</p>
          </div>
          <div className="movies-header-actions">
            <button type="button" className="logout-button" onClick={handleLogout}> {/* event emitter for logging out */}
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
                      <div
                        className="movie-row admin-movie-row"
                        key={movie.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/adminMovie/${movie.id}`)}
                      >
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
                    <button type="button" disabled={moviePage === 1} onClick={() => changeMoviePage(-1)}>
                      Previous
                    </button>
                    <span>Page {moviePage} of {totalMoviePages}</span>
                    <button type="button" disabled={moviePage === totalMoviePages} onClick={() => changeMoviePage(1)}>
                      Next
                    </button>
                  </nav>
                </>
              )}
            </section>

            <section className="profile-favorites admin-section" aria-labelledby="reviews-heading">
              <div className="profile-section-heading">
                <div>
                  <p className="movie-panel-label">REVIEWS</p>
                  <h2 id="reviews-heading">User Reviews</h2>
                </div>
                <span>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
              </div>

              {reviews.length === 0 ? (
                <p className="movies-state profile-empty-state">No reviews found.</p>
              ) : (
                <div className="admin-review-list" aria-label="User reviews">
                  {reviews.map((review, index) => (
                    <article className="admin-review" key={review.review_id}>
                      <div className="admin-review-heading">
                        <span className="movie-number">{String(index + 1).padStart(2, '0')}</span>
                        <div className="admin-review-user">
                          <strong>{review.user_name}</strong>
                          <span>{review.user_email}</span>
                        </div>
                        <div className="admin-review-movie">
                          <span>Movie</span>
                          <strong>{review.movie_title}</strong>
                        </div>
                        <span className="review-rating">{review.rating}/5</span>
                      </div>
                      <p className="admin-review-text">{review.review}</p>
                    </article>
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

export default AdminHome
