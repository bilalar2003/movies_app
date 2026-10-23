import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProtected, logout } from '../services/api'
import AdminConfirmModal from '../modals/AdminConfirmModal'
import AdminEditModal from '../modals/AdminEditModal'
import '../App.css'

function AdminRowActions({ itemType, record, onEdit, onRemove }) {
  return (
    <span className="admin-row-actions">
      <button
        className="admin-row-action"
        type="button"
        aria-label={`Edit ${itemType}`}
        title={`Edit ${itemType}`}
        onClick={(event) => {
          event.stopPropagation()
          onEdit(itemType, record)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m16 4 4 4M4 20l4-.8L19.2 8a2.1 2.1 0 0 0-3-3L5 16.2 4 20Z" />
        </svg>
      </button>
      <button
        className="admin-row-action admin-row-action-delete"
        type="button"
        aria-label={`Delete ${itemType}`}
        title={`Delete ${itemType}`}
        onClick={(event) => {
          event.stopPropagation()
          onRemove(itemType, record)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      </button>
    </span>
  )
}

function AdminAddButton({ itemType, onClick }) {
  return (
    <button
      className="admin-add-button"
      type="button"
      onClick={() => onClick(itemType)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add {itemType}
    </button>
  )
}

function AdminHome() {
  const navigate = useNavigate() // to navigate between pages
  const [users, setUsers] = useState([]) // state to hold all user rows registered in the app (fetched from DB)
  const [movies, setMovies] = useState([]) // state to hold all movie rows in DB
  const [reviews, setReviews] = useState([]) // state to hold all movie reviews in DB
  const [moviePage, setMoviePage] = useState(1) // state to hold current page number for 
  const [totalMoviePages, setTotalMoviePages] = useState(1) // state to hold total pages needed to display all movie rows
  const [loading, setLoading] = useState(true) // same as before 
  const [errorMessage, setErrorMessage] = useState('') // same as before 
  const [actionErrorMessage, setActionErrorMessage] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [removingItem, setRemovingItem] = useState(null)
  const scrollPositionRef = useRef(null) // ref to hold current scroll position 
  const [successMessage, setSuccessMessage] = useState('') // state to hold success msg for displaying 
  const apiPrefix = '/api/'
  const adminPrefix = 'admin/'

  // effect to show success msg that disappears after 5 seconds 
  useEffect(() => {
    if (!successMessage)
      return undefined // if not msg, exit early 

    // starts timeout, resets success msg to empty to make it disappear
    // after 5 seconds 
    const timeoutId = setTimeout(() => {
      setSuccessMessage('')
    }, 5000)

    // below stops the old 5-second timer, so that new success msg 
    // disappears after exact 5 seconds 
    return () => clearTimeout(timeoutId)
  }, [successMessage])

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

  const handleEdit = (type, record) => {
    setEditingItem({ type, record, mode: 'edit' })
  }

  const handleAdd = (type) => {
    setEditingItem({ type, record: {}, mode: 'create' })
  }

  const handleRemoveRequest = (type, record) => {
    setRemovingItem({ type, record })
  }

  const handleConfirmRemove = async () => {
    if (!removingItem) {
      return
    }

    if (removingItem.type === 'user') {
      setActionErrorMessage('')

      try {
        const response = await fetchProtected(
          `${apiPrefix}${adminPrefix}users/${removingItem.record.id}`,
          { method: 'DELETE' }
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Failed to remove user')
        }

        setUsers((currentUsers) => currentUsers.filter((user) => user.id !== removingItem.record.id))
        setReviews((currentReviews) => currentReviews.filter(
          (review) => review.user_email !== removingItem.record.email
        ))
        setActionErrorMessage('')
        setSuccessMessage('User removed successfully.')
      } catch (error) {
        setActionErrorMessage(error.message || 'Failed to remove user.')
      }
    } else if (removingItem.type === 'movie') {
      setActionErrorMessage('')

      try {
        const response = await fetchProtected(
          `${apiPrefix}${adminPrefix}movies/${removingItem.record.id}`,
          { method: 'DELETE' }
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Failed to remove movie')
        }

        setMovies((currentMovies) => currentMovies.filter((movie) => movie.id !== removingItem.record.id))
        setReviews((currentReviews) => currentReviews.filter(
          (review) => review.movie_id !== removingItem.record.id
        ))

        if (moviePage === totalMoviePages && movies.length === 1 && moviePage > 1) {
          setMoviePage((currentPage) => currentPage - 1)
          setTotalMoviePages((currentTotal) => Math.max(1, currentTotal - 1))
        }

        setSuccessMessage('Movie removed successfully.')
      } catch (error) {
        setActionErrorMessage(error.message || 'Failed to remove movie.')
      }
    } else {
      setActionErrorMessage('')

      try {
        const response = await fetchProtected(
          `${apiPrefix}${adminPrefix}reviews/${removingItem.record.review_id}`,
          { method: 'DELETE' }
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Failed to remove review')
        }

        setReviews((currentReviews) => currentReviews.filter(
          (review) => review.review_id !== removingItem.record.review_id
        ))
        setSuccessMessage('Review removed successfully.')
      } catch (error) {
        setActionErrorMessage(error.message || 'Failed to remove review.')
      }
    }

    setRemovingItem(null)
  }

  const handleSaveEdit = async (values) => {
    if (!editingItem) {
      return
    }

    if (editingItem.mode === 'create' && editingItem.type === 'user') {
      const response = await fetchProtected(`${apiPrefix}${adminPrefix}users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create user')
      }

      const usersResponse = await fetchProtected(`${apiPrefix}${adminPrefix}users`)
      const usersData = await usersResponse.json()

      if (!usersResponse.ok) {
        throw new Error(usersData.message || 'User was created, but the user list could not be refreshed')
      }

      setUsers(usersData.users || [])
      setSuccessMessage('New user created successfully.')
      return
    } else if (editingItem.mode === 'create' && editingItem.type === 'movie') {
      const response = await fetchProtected(`${apiPrefix}${adminPrefix}movies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(),
          description: values.description.trim(),
          genre: values.genre.trim(),
          rating: values.rating,
          release_year: Number(values.release_year),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create movie')
      }

      const moviesResponse = await fetchProtected(
        `${apiPrefix}movies?page=${totalMoviePages + 1}`
      )
      const moviesData = await moviesResponse.json()

      if (!moviesResponse.ok) {
        throw new Error(moviesData.message || 'Movie was created, but the movie list could not be refreshed')
      }

      setMovies(moviesData.movies || [])
      setTotalMoviePages(moviesData.totalPages || 1)
      setMoviePage(moviesData.page || 1)
      setSuccessMessage('New movie created successfully.')
      return
    } else if (editingItem.type === 'user') {
      const original = editingItem.record
      const updates = {}
      const name = values.name.trim()
      const email = values.email.trim().toLowerCase()

      if (name !== original.name) updates.name = name
      if (email !== original.email.toLowerCase()) updates.email = email
      if (values.password) updates.password = values.password
      if (Object.keys(updates).length === 0) return

      const response = await fetchProtected(
        `${apiPrefix}${adminPrefix}users/${original.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user')
      }

      setUsers((currentUsers) => currentUsers.map(
        (user) => user.id === original.id ? data.user : user
      ))
      setReviews((currentReviews) => currentReviews.map((review) => (
        review.user_email === original.email
          ? { ...review, user_name: data.user.name, user_email: data.user.email }
          : review
      )))
      setSuccessMessage('User updated successfully.')
    } else if (editingItem.type === 'movie') {
      const original = editingItem.record
      const updates = {}
      const title = values.title.trim()
      const description = values.description.trim()
      const genre = values.genre.trim()
      const rating = values.rating === '' ? null : Number(values.rating)
      const releaseYear = values.release_year === '' ? null : Number(values.release_year)

      if (title !== original.title) updates.title = title
      if (description !== (original.description || '')) updates.description = description
      if (genre !== (original.genre || '')) updates.genre = genre
      if (rating !== (original.rating == null ? null : Number(original.rating))) updates.rating = rating
      if (releaseYear !== (original.release_year ?? null)) updates.release_year = releaseYear
      if (Object.keys(updates).length === 0) return

      const response = await fetchProtected(
        `${apiPrefix}${adminPrefix}movies/${original.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update movie')
      }

      setMovies((currentMovies) => currentMovies.map(
        (movie) => movie.id === original.id ? data.movie : movie
      ))
      if (updates.title) {
        setReviews((currentReviews) => currentReviews.map((review) => (
          review.movie_id === original.id
            ? { ...review, movie_title: data.movie.title }
            : review
        )))
      }
      setSuccessMessage('Movie updated successfully.')
    } else {
      const original = editingItem.record
      const updates = {}
      const rating = Number(values.rating)

      if (rating !== Number(original.rating)) updates.rating = rating
      if (values.review !== (original.review || '')) updates.review = values.review
      if (Object.keys(updates).length === 0) return

      const response = await fetchProtected(
        `${apiPrefix}${adminPrefix}reviews/${original.review_id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update review')
      }

      setReviews((currentReviews) => currentReviews.map(
        (review) => review.review_id === original.review_id ? data.review : review
      ))
      setSuccessMessage('Review updated successfully.')
    }
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
        {successMessage && (
          <p className="alert alert-success" role="status">
            {successMessage}
          </p>
        )}
        {actionErrorMessage && (
          <p className="movies-state movies-state-error" role="alert">
            {actionErrorMessage}
          </p>
        )}

        {!loading && !errorMessage && (
          <>
            <section className="profile-favorites admin-section" aria-labelledby="users-heading">
              <div className="profile-section-heading">
                <div>
                  <p className="movie-panel-label">USERS</p>
                  <h2 id="users-heading">Registered Users</h2>
                </div>
                <div className="admin-section-actions">
                  <span className="admin-users-count">{users.length} {users.length === 1 ? 'user' : 'users'}</span>
                  <AdminAddButton itemType="user" onClick={handleAdd} />
                </div>
              </div>

              {users.length === 0 ? (
                <p className="movies-state profile-empty-state">No users found.</p>
              ) : (
                <div className="movie-list" aria-label="Users list">
                  {users.map((user, index) => (
                    <div className="movie-row admin-user-row" key={user.id}>
                      <span className="movie-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="movie-main">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </span>
                      <span className="admin-user-role">
                        <span>{user.role}</span>
                        <AdminRowActions itemType="user" record={user} onEdit={handleEdit} onRemove={handleRemoveRequest} />
                      </span>
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
                <div className="admin-section-actions">
                  <span>{movies.length} {movies.length === 1 ? 'movie' : 'movies'}</span>
                  <AdminAddButton itemType="movie" onClick={handleAdd} />
                </div>
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
                        <AdminRowActions itemType="movie" record={movie} onEdit={handleEdit} onRemove={handleRemoveRequest} />
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
                <span style={{ marginRight: '40px' }}>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
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
                        <div className="admin-review-field admin-review-movie">
                          <span className="admin-review-field-label">Movie</span>
                          <strong title={review.movie_title}>{review.movie_title}</strong>
                        </div>
                        <div className="admin-review-field admin-review-content">
                          <span className="admin-review-field-label">Review</span>
                          <span className="admin-review-inline-text" title={review.review}>
                            {review.review}
                          </span>
                        </div>
                        <div className="admin-review-controls">
                          <div className="admin-review-field admin-review-rating">
                            <span className="admin-review-field-label">Rating</span>
                            <span className="review-rating">{review.rating}/5</span>
                          </div>
                          <AdminRowActions itemType="review" record={review} onEdit={handleEdit} onRemove={handleRemoveRequest} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
      {editingItem && (
        <AdminEditModal
          key={`${editingItem.type}-${editingItem.mode}-${editingItem.record.id ?? editingItem.record.review_id ?? 'new'}`}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEdit}
        />
      )}
      {removingItem && (
        <AdminConfirmModal
          key={`${removingItem.type}-${removingItem.record.id ?? removingItem.record.review_id}`}
          item={removingItem}
          onCancel={() => setRemovingItem(null)}
          onConfirm={handleConfirmRemove}
        />
      )}
    </main>
  )
}

export default AdminHome
