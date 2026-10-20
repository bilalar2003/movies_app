import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProtected, logout, updateFavorite } from '../services/api'
import '../App.css'

// NOTE::: calling a state setter doesn’t re-render immediately, 
// it only queues an update, 
// so your function keeps running through the second and third setters to the end, 
// and then React (18+) batches all three into a single re-render.

// NOTE::: Access token in localStorage (or memory): JavaScript needs to read it so it can attach it to
// the Authorization header on every API request. 
// It's short-lived, so if it’s stolen the damage is limited.
// though it's better to store it in memory instead of localStorage

// Refresh token in an HttpOnly cookie: it’s long-lived and more powerful, 
// so it’s kept where JavaScript can’t read it, which protects it from XSS theft. 
// The browser sends it automatically only to your server when a new accessToken is needed.

// XSS (cross-site scripting) theft is when an attacker injects 
// malicious JavaScript into your site that runs in a user’s browser and steals data it can read, like tokens in localStorage.

function Home() {
  const navigate = useNavigate() // used to route between pages. 
  const [movies, setMovies] = useState([]) // array state to hold list of movies to display on page.
  const [page, setPage] = useState(1) // state to hold current page no. for pagination (default is 1).
  const [pageOffset, setPageOffset] = useState(0) // state to keep track of the offset for the current page, 
  // used for numbering movies correctly across pages. Default is 0, meaning first page starts from 1.
  const [pageLimit, setPageLimit] = useState(10) // used to set movies limit at each page, default to 10.
  const [totalPages, setTotalPages] = useState(1) // to hold total no. of pages available for pagination, default to 1.
  const [loading, setLoading] = useState(true) // state to show if movies are loading or not, default to true. 
  const [errorMessage, setErrorMessage] = useState('') // same as before.
  const [isLoggingOut, setIsLoggingOut] = useState(false) // state to show if user is logging out or not, 
  // default to false.
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false) // state to show if profile menu is open or not, 
  // default to false.
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState(null) // state to hold the ID of the movie being updated for favorite status,
  // default to null.
  const scrollPositionRef = useRef(null) // ref to hold the scroll position when navigating between the movies list pages,
  // default to null.
  const profileMenuRef = useRef(null) // ref to hold the profile menu element,
  // used for closing the menu when clicking outside of it.

  const handleLogout = async () => {
    setIsLoggingOut(true) // it sets IsLoggingOut state to true, indicates user is logging out.
    await logout() // calls logout() method from api.js, 
    // which sends a request to backend to log the user out.
    navigate('/', { replace: true }) // after logging out, user redirected to landing page. 
    // above, 'replace: true' makes the navigation replace the current entry in the browser’s history stack,
    // instead of adding a new one,
    // so after logout the user can’t press the Back button to return to the logged-in page.
  }

  const changePage = (direction) => { // eventListener function, runs upon page change click. direction is parameter,
    // that holds values -1 or 1, respecitvely indicating to move to prev. & next page. 
    scrollPositionRef.current = window.scrollY // save the vertical scroll position of page into the ref. value
    setPage((current) => current + direction) // update page state variable to new page number
  }

  const handleFavoriteToggle = async (event, movie) => {
    event.stopPropagation() // stops click from passing up to parent
    // Without it, clicking the heart toggles the favorite 
    // and then the click also reaches the row and opens the movie page; 
    // with it, the click stops at the heart, so only the favorite toggles.
    if (updatingFavoriteId === movie.id) { // this is a guard that checks, 
      return  // if fave movie update is already in progress, if yes then it exits the click
    } // it actually ignores repeated clicks 
    setUpdatingFavoriteId(movie.id) // set id of movie faved by user into state variable

    try {
      // below sends movie id to be faved, and other param is the opp. fav value to set
      const isFavorite = await updateFavorite(movie.id, !movie.is_favorite)
      setMovies((currentMovies) => currentMovies.map((currentMovie) => (
        // above iterates through all movies currently shown,
        // finds the one for which the fave toggle was clicked 
        // updates the fave icon for it, according to isFavorite variable,
        // for which the backend sent its updated value. 
        currentMovie.id === movie.id
          ? { ...currentMovie, is_favorite: isFavorite }
          : currentMovie
      )))
    } catch (error) {
      setErrorMessage(error.message)
      if (error.message === 'Session expired') {
        navigate('/', { replace: true }) // this logs out user if refreshToken expired
      }
    } finally {
      setUpdatingFavoriteId(null) // reset fave movie id to null, 
      // flag the fave click as complete
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

  useEffect(() => {
    const closeProfileMenu = (event) => { // this runs when user clicks outside profile menu
      if (!profileMenuRef.current?.contains(event.target)) {
        // in above, profileMenuRef is the reference to the profile menu element, 
        // current is the current value of this ref,
        // ? runs .contains only if current isn't null,
        // contains() checks if profile menu contains the element that was clicked (event.target),
        // and event.target is the actual element that user clicked.
        setIsProfileMenuOpen(false) // sets profile menu state to false,
        // closing the menu when user clicks outside of it.
      }
    } //contains() returns true when the click was inside the menu, so ! flips it to “the click was outside”

    document.addEventListener('mousedown', closeProfileMenu) // add event listener when mouse is clicked down, 
    // to close profile menu when user clicks outside of it.
    //IMP: 'mousedown' is eventType, and closeProfileMenu is the eventHandler.
    return () => document.removeEventListener('mousedown', closeProfileMenu)
    // above removes the event listener when component unmounts, to prevent memory leaks.
  }, []) // this useEffect() runs only once, when components first loads.
  // it runs when home page loads for the first time,
  // and upon it, it just adds the event listener on entire document,
  // the browser automatically triggers the mousedown event when user clicks anywhere on the page,
  // then it checks if the mouse click was outside the profile menu,
  // if so, it closes the profile menu 
  // by setting isProfileMenuOpen state to false.

  useLayoutEffect(() => { // this runs when movies state changes (the page re-renders and this useEffect runs)
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

  useEffect(() => { // this useEffect() runs when Home.jsx page is accessed.
    let isCurrent = true // this prevents an old movie request from changing page
    // If you go to another page while movies are still loading, 
    // it stops that old request from updating Home afterward.

    // it's actually the indicator for if the useEffect is active or not. 

    const loadMovies = async () => {
      setLoading(true) // set loading to true, showing we're loading movies for displaying
      setErrorMessage('')

      try { // this page in turn calls fetchProtected API for retreiving the movies list
        const response = await fetchProtected(`/api/movies?page=${page}`)
        // above is a call to protected route for retreiving movies.
        const data = await response.json()

        if (!response.ok) { // if 403, Forbidden error message is set & displayed on page. 
          throw new Error(data.message || 'Failed to load movies')
        } // if not 200 response, throw error.

        // if received response is 200 OK, set all movies states for displaying movies on page.
        if (isCurrent) { // if useEffect is still active, set movies data to display on page.
          setMovies(data.movies) // store movies rows in state.
          setPageOffset(data.offset) // set page offset. 
          setPageLimit(data.limit) // store limit of displaying movies on each page. 
          setTotalPages(data.totalPages) // store total pages needed to show all movies.
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

    return () => { // set isCurrent back to false.
      // marking the useEffect as inactive. 
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
                {/*Above is where the profileMenu is rendered*/}
                {/*Upon clicking profile button, profileMenu state is set to true*/}
                {/*The event for closing the profile menu is handled in the useEffect hook*/}
                {/*By clicking outside profile menu*/}
                <span className="profile-icon" aria-hidden="true">&#128100;</span>
              </button>
              {isProfileMenuOpen && (
                <div className="profile-dropdown" role="menu">
                  <button type="button" role="menuitem" onClick={() => navigate('/profile')}> {/* nav. to profile page on click */}
                    View Profile
                  </button>
                  <button type="button" role="menuitem" onClick={handleLogout} disabled={isLoggingOut}>
                    {isLoggingOut ? 'Logging out...' : 'Log Out'}
                  </button> {/*When above button is clicked, isLoggingOut is set to true*/}
                  {/* and the logout function is called*/}
                </div>
              )}
            </div>
          </div>
        </header>

        {loading && <p className="movies-state">Loading movies...</p>}
        {errorMessage && <p className="movies-state movies-state-error">{errorMessage}</p>}

        {/*Below runs when movies are loaded and there's no error*/}
        {!loading && !errorMessage && (
          <>
            <div className="movie-list" aria-label="Movie list">
              {/*Below maps movies into the list on page for displaying*/}
              {movies.map((movie, index) => (
                <div
                  className="movie-row"
                  key={movie.id}
                  role="link"
                  tabIndex="0"
                  onClick={() => navigate(`/movies/${movie.id}`)}
                  // onKeyDown={(event) => {
                  //   if (event.key === 'Enter' || event.key === ' ') {
                  //     event.preventDefault()
                  //     navigate(`/movies/${movie.id}`)
                  //   }
                  // }}
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
                    // above line greys out and blocks the heart button for that movie,
                    // while its favorite request is running, so it can’t be clicked twice.
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
              </button> {/* Here, both the event emitters call changePage upon page change button is clicked */}
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
