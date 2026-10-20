import chalk from 'chalk'
import { pool } from '../config/db.js'
import { verifyToken } from '../middleware/auth.js'

const apiPrefix = '/api/'
const duplicateReviewMessage = 'You already have submitted a review for this movie.'

// used by logRequest 
const methodColors = {
  GET: chalk.green,
  POST: chalk.yellow,
  PUT: chalk.blue,
  DELETE: chalk.red
}

// helper method to log api call on terminal, this helps in reusability
const logRequest = (req, url) => {
  const colorFn = methodColors[req.method] || chalk.white
  console.log(`${colorFn(req.method)} ${url}`)
}

// helper method to set reponse object and send it, this helps in reusability
const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}
const handleReviewSubmission = (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = verifyToken(req)

  if (!authenticatedUser) {
    sendJson(res, 401, { message: 'Authentication required.' })
    return
  }

  if (authenticatedUser.role !== 'user') {
    sendJson(res, 403, { message: 'Only users can submit reviews.' })
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk
  })

  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {}
      const rating = Number(parsed.rating)
      const review = typeof parsed.review === 'string' ? parsed.review.trim() : ''
      const movieId = parseInt(url.pathname.split('/')[3], 10)

      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !review) {
        sendJson(res, 400, {
          message: 'A rating from 1 to 5 and a review are required.',
        })
        return
      }

      // check if user has already submitted a review for the movie 
      const existingReview = await pool.query( 
        'SELECT 1 FROM movie_reviews WHERE user_id = $1 AND movie_id = $2',
        [authenticatedUser.userId, movieId]
      )

      // if yes, then send error message to frontend 
      if (existingReview.rows.length > 0) {
        sendJson(res, 409, {
          message: duplicateReviewMessage 
        })
        return
      }

      await pool.query(
        'INSERT INTO movie_reviews (user_id, movie_id, rating, review) VALUES ($1, $2, $3, $4)',
        [authenticatedUser.userId, movieId, rating, review]
      ) // insert movie review into table 

      sendJson(res, 201, { // send 201:Created message on request completion 
        message: 'Review submitted successfully.'
      })
    } catch (error) {
      if (error?.code === '23503') {
        // 23503 is postgres foreign_key_violation error code, 
      // which here means the movie_id does not exist in the movies table
        sendJson(res, 404, { message: 'Movie not found.' })
        return
      }

      if (error?.code === '23505' && error?.constraint === 'movie_reviews_user_movie_unique') {
        sendJson(res, 409, {
          message: duplicateReviewMessage
        })
        return
      }

      console.error('Review submission error:', error)
      sendJson(res, 500, { message: 'Failed to submit review.' })
      // send 500: Internal Server Error if an error occurred 
    }
  })
}

// this function is to handle favourite toggle of movie by user
const handleFavoriteToggle = async (req, res, url, shouldFavorite) => {
  logRequest(req, url) // to log the api call on terminal with color

  const authenticatedUser = verifyToken(req) // verify accessToken before 
  // processing the fave click

  if (!authenticatedUser) { 
    sendJson(res, 401, { message: 'Authentication required.' })
    // 401: Unauthorized, means accessToken expired, need new one
    return
  }

  if (authenticatedUser.role !== 'user') {
    sendJson(res, 403, { message: 'Only users can manage favorites.' })
    // 403: Forbidden, means you lack permission for requested functionality 
    return
  }

  const movieId = Number.parseInt(url.pathname.split('/').pop(), 10)
  // .split() splits the path string into an array at each /
  // e.g giving ['', 'api', 'favorites', '42']
  //.pop() removes and returns last element of array
  // 10 means base 10, so 42 becomes 42. 

  try { 
    if (shouldFavorite) { // shouldFavourite holds bool value for if to fave or not.
      await pool.query( // if true, then set fave in DB table
        'INSERT INTO favorites (user_id, movie_id) VALUES ($1, $2) ON CONFLICT (user_id, movie_id) DO NOTHING',
        [authenticatedUser.userId, movieId] // 'on conflict' means to skip insertion,
        // if the row already exists 
      )
    } else {
      await pool.query( // else remove the favourite
        'DELETE FROM favorites WHERE user_id = $1 AND movie_id = $2',
        [authenticatedUser.userId, movieId]
      )
    }

    sendJson(res, 200, { isFavorite: shouldFavorite }) // send response with new fave value
  } catch (error) {
    if (error?.code === '23503') {
      // 23503 is postgres foreign_key_violation error code, 
      // which here means the movie_id does not exist in the movies table
      sendJson(res, 404, { message: 'Movie not found.' })
      return
    }

    console.error('Favorite update error:', error)
    sendJson(res, 500, { message: 'Failed to update favorite.' })
  }
}

const handleUserProfile = async (req, res, url) => {
  logRequest(req, url) // log request on terminal 

  const authenticatedUser = verifyToken(req) // verify accessToken 

  if (!authenticatedUser) { // send 
    sendJson(res, 401, { message: 'Authentication required.' })
    // 401: Unauthorized, means accessToken expired, need new one
    return
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [authenticatedUser.userId]
    ) // find user in DB table by their id 

    if (result.rows.length === 0) {
      sendJson(res, 404, { message: 'User profile not found.' })
      // 404 Not found: means requested resource was not found 
      return
    }

    const favoritesResult = await pool.query( // retrieve all movie faves of user 
      `SELECT movies.id, movies.title, movies.description, movies.genre, movies.rating, movies.release_year,
        TRUE AS is_favorite
       FROM favorites
       JOIN movies ON movies.id = favorites.movie_id
       WHERE favorites.user_id = $1
       ORDER BY favorites.id DESC`,
      [authenticatedUser.userId] // by user id
    ) // TRUE AS actually creates new column to return with each value set to true
    // this is actually to show all the movies that have been liked by user 

    const reviewsResult = await pool.query( // retrieve all movie reviews of user 
      `SELECT mr.id AS review_id, mr.rating AS user_rating, mr.review,
        m.id, m.title, m.description, m.genre, m.rating AS movie_rating, m.release_year
       FROM movie_reviews mr
       JOIN movies m ON m.id = mr.movie_id
       WHERE mr.user_id = $1
       ORDER BY mr.id DESC`,
      [authenticatedUser.userId] // by user id 
    )

    sendJson(res, 200, { // return user details 
      user: result.rows[0],
      favorites: favoritesResult.rows,
      reviews: reviewsResult.rows,
    })
  } catch (error) {
    console.error('Profile error:', error)
    sendJson(res, 500, { message: 'Failed to load profile.' })
    // 500: Internal Server Error, means error occurred at server side 
  }
}

export async function handleUserRoutes(req, res, url) { // this is the router invoked from server.js 
  
  // User endpoint to fetch and display User Profile Details
  if (req.method === 'GET' && url.pathname === `${apiPrefix}profile`) {
    await handleUserProfile(req, res, url)
    return true
  }

  // User endpoint for adding/removing a movie as user's favourite
  if (new RegExp(`^${apiPrefix}favorites/\\d+$`).test(url.pathname)) {
    if (req.method === 'PUT' || req.method === 'DELETE')
      await handleFavoriteToggle(req, res, url, req.method === 'PUT')
    return true // same. 
  }

  // User Endpoint to submit user's movie review
  if (req.method === 'POST' && new RegExp(`^${apiPrefix}movies/\\d+/reviews$`).test(url.pathname)) {
    handleReviewSubmission(req, res, url)
    return true // same. 
  }

  return false // same. 
}
