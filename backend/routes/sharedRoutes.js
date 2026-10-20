import chalk from 'chalk'
import { pool } from '../config/db.js'
import { verifyToken } from '../middleware/auth.js'

const apiPrefix = '/api/'

// same, used to color print method text on terminal
const methodColors = {
  GET: chalk.green,
  POST: chalk.yellow, 
  DELETE: chalk.red
}

const logRequest = (req, url) => {
  const colorFn = methodColors[req.method] || chalk.white
  console.log(`${colorFn(req.method)} ${url}`)
}

// below is function for sending back response, helps in reusability. 
const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload)) 
  // NOTE: this code block ends server response, 
  // sending control back to api.js. 
}

const requireAccess = (req, res) => { // helper method to authenticate user via accessToken
  // helps in keeping code clean.
  const authenticatedUser = verifyToken(req)

  if (!authenticatedUser) {
    sendJson(res, 401, { message: 'Authentication required.' })
    // if accessToken expired, send 401: Unauthorized Error
    return null
  }

  if (!['user', 'admin'].includes(authenticatedUser.role)) {
    // if user not having user or admin role, send 403: Forbidden error
    sendJson(res, 403, { message: 'You are not authorized to view movies.' })
    return null
  }
 
  return authenticatedUser
}

const handleMovieDetails = async (req, res, url) => {
  logRequest(req, url) // log api call on terminal

  if (!requireAccess(req, res)) {
    return
  } // if user not with admin or user role, return auth error 

  const movieId = parseInt(url.pathname.split('/').pop(), 10)
  // break pathname into seperate strings via '/'
  // pop the last string letter (that is the movie id),
  // convert to integer base 10 and store in movieId variable 

  try {
    const result = await pool.query(
      'SELECT id, title, description, genre, rating, release_year FROM movies WHERE id = $1',
      [movieId] // get movie details from DB
    )

    if (result.rows.length === 0) { // send 404 not found error if movie not found 
      sendJson(res, 404, { message: 'Movie not found.' })
      return
    }

    const reviewsResult = await pool.query(
      `SELECT mr.id AS review_id, mr.rating AS user_rating, mr.review, u.name AS user_name
       FROM movie_reviews mr
       INNER JOIN users u ON u.id = mr.user_id
       WHERE mr.movie_id = $1
       ORDER BY mr.id DESC`,
      [movieId]
    ) // retrieve all reviews of the movie from the DB

    sendJson(res, 200, {
      movie: result.rows[0],
      reviews: reviewsResult.rows,
    }) // set response for 200 OK
  } catch (error) {
    console.error('Movie details error:', error)
    sendJson(res, 500, { message: 'Failed to load movie details.' })
    // send 500: Internal Server Error if any error occurred
  }
}

const handleMovieList = async (req, res, url) => {
  const authenticatedUser = requireAccess(req, res)
  if (!authenticatedUser) {
    return
  }

  // extracts requested page number in query string that was passed, ie 1, 2, 3.
  // parseInt() converts string into integer,
  // url.searchParams.get('page') retrieves the value of the page query parameter,
  //  from the URL.
  // 10 specifies base 10 when converting to integer, decimal number actually. 
  const requestedPage = parseInt(url.searchParams.get('page'), 10)
  // below checks if extracted page number is integer & > 0, else set it to integer 1. 
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const firstPageLimit = 10 // max movies returned on page 1, which is 10.
  const laterPageLimit = 10 // max movies returned on each later page, which is 10.

  try {
    
    // count all movies in DB.
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM movies' // converts to integer,
      // returns result column named total,
      // so we can access it using countResult.rows[0].total
    )
    // access total from above SQL query result.
    const totalMovies = countResult.rows[0].total 
    
    // calculate how many pages are needed.
    let totalPages = 1
    if (totalMovies > firstPageLimit) { // this computes total pages needed 
    // to display all movies.
      const remainingMovies = totalMovies - firstPageLimit
      const remainingPages = Math.ceil(
        remainingMovies / laterPageLimit
      ) // return rounded up nearest number of pages needed. 
      totalPages = 1 + remainingPages
    }

    // make sure the requested page exists.
    let currentPage = page
    if (currentPage > totalPages) { // if currentpage exceeds totalPages, 
      currentPage = totalPages // set currentPage to last page. 
    }

    // decide how many movies to fetch.
    let limit = laterPageLimit
    if (currentPage === 1) {
      limit = firstPageLimit // set limit to that of firstPage is currentPage is 1,
    } // if not, then keep that of later pages. 

    // calculate where to start fetching movies
    // from the DB,
    let offset = 0 // this offset is sent in SQL query. 
    if (currentPage > 1) {
      const previousPages = currentPage - 2
      const moviesInPreviousPages =
        previousPages * laterPageLimit

      offset = firstPageLimit + moviesInPreviousPages
    }
    
    const moviesResult = await pool.query(
      `SELECT movies.id, movies.title, movies.description, movies.genre, movies.rating, movies.release_year,
        EXISTS (
          SELECT 1 FROM favorites
          WHERE favorites.movie_id = movies.id AND favorites.user_id = $1
        ) AS is_favorite
       FROM movies
       ORDER BY movies.id
       LIMIT $2 OFFSET $3`,
      [authenticatedUser.userId, limit, offset]
    )
   // SELECT 1 FROM favorites: looks for matching records in the favorites table.
   // favorites.movie_id = movies.id: checks whether the record belongs to the current movie.
   // favorites.user_id = $1: checks whether the record belongs to the logged-in user ($1 is their user ID).
   // EXISTS (...): returns true if at least one matching record exists, otherwise, false.
   // AS is_favorite: names this result is_favorite in the query output.
   // eg: If movie ID 5 is in user ID 2's favorites, is_favorite will be true for that movie when $1 = 2.

    sendJson(res, 200, { // send success response with all movies data to display on page. 
      movies: moviesResult.rows,
      page: currentPage,
      limit,
      offset,
      totalMovies,
      totalPages,
    })
  } catch (error) {
    console.error('Movies error:', error)
    // 500: Internal Server Error, tells 'failed to load movies'. 
    sendJson(res, 500, { message: 'Failed to load movies.' })
  }
}

export async function handleSharedRoutes(req, res, url) {

  // this is endpoint to retrieve movies list for specified page no. in query string.
  if (req.method === 'GET' && url.pathname === `${apiPrefix}movies`) {
    await handleMovieList(req, res, url) // above function called, for handling movies list.
    return true // same.
  }

  // this is endpoint for retrieving movie selected by user to view it on movie.jsx page. 
  if (req.method === 'GET' && new RegExp(`^${apiPrefix}movies/\\d+$`).test(url.pathname)) {
    await handleMovieDetails(req, res, url)
    return true // same. 
  }

  return false // same.
}

// NOTE: This is our complete url object being passed in the route handler methods:
// URL {
//   href: 'http://localhost:4000/api/movies/2',
//   origin: 'http://localhost:4000',
//   protocol: 'http:',
//   username: '',
//   password: '',
//   host: 'localhost:4000',
//   hostname: 'localhost',
//   port: '4000',
//   pathname: '/api/movies/2',
//   search: '',
//   searchParams: URLSearchParams {},
//   hash: ''
// }