import chalk from 'chalk'
import { pool } from '../config/db.js'
import { verifyToken } from '../middleware/auth.js'

const methodColors = {
  GET: chalk.green,
  POST: chalk.yellow,
}

const logRequest = (req, url) => {
  const colorFn = methodColors[req.method] || chalk.white
  console.log(`${colorFn(req.method)} ${url}`)
}

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
      const movieId = Number.parseInt(url.pathname.split('/')[3], 10)

      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !review) {
        sendJson(res, 400, {
          message: 'A rating from 1 to 5 and a review are required.',
        })
        return
      }

      const result = await pool.query(
        'INSERT INTO movie_reviews (user_id, movie_id, rating, review) VALUES ($1, $2, $3, $4) RETURNING id, movie_id, rating, review',
        [authenticatedUser.userId, movieId, rating, review]
      )

      sendJson(res, 201, {
        message: 'Review submitted successfully.',
        review: result.rows[0],
      })
    } catch (error) {
      if (error?.code === '23503') {
        sendJson(res, 404, { message: 'Movie not found.' })
        return
      }

      console.error('Review submission error:', error)
      sendJson(res, 500, { message: 'Failed to submit review.' })
    }
  })
}

const handleFavoriteToggle = async (req, res, url, shouldFavorite) => {
  logRequest(req, url)

  const authenticatedUser = verifyToken(req)

  if (!authenticatedUser) {
    sendJson(res, 401, { message: 'Authentication required.' })
    return
  }

  if (authenticatedUser.role !== 'user') {
    sendJson(res, 403, { message: 'Only users can manage favorites.' })
    return
  }

  const movieId = Number.parseInt(url.pathname.split('/').pop(), 10)

  try {
    if (shouldFavorite) {
      await pool.query(
        'INSERT INTO favorites (user_id, movie_id) VALUES ($1, $2) ON CONFLICT (user_id, movie_id) DO NOTHING',
        [authenticatedUser.userId, movieId]
      )
    } else {
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND movie_id = $2',
        [authenticatedUser.userId, movieId]
      )
    }

    sendJson(res, 200, { isFavorite: shouldFavorite })
  } catch (error) {
    if (error?.code === '23503') {
      sendJson(res, 404, { message: 'Movie not found.' })
      return
    }

    console.error('Favorite update error:', error)
    sendJson(res, 500, { message: 'Failed to update favorite.' })
  }
}

const handleUserProfile = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = verifyToken(req)

  if (!authenticatedUser) {
    sendJson(res, 401, { message: 'Authentication required.' })
    return
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [authenticatedUser.userId]
    )

    if (result.rows.length === 0) {
      sendJson(res, 404, { message: 'User profile not found.' })
      return
    }

    const favoritesResult = await pool.query(
      `SELECT movies.id, movies.title, movies.description, movies.genre, movies.rating, movies.release_year,
        TRUE AS is_favorite
       FROM favorites
       INNER JOIN movies ON movies.id = favorites.movie_id
       WHERE favorites.user_id = $1
       ORDER BY favorites.id DESC`,
      [authenticatedUser.userId]
    )

    const reviewsResult = await pool.query(
      `SELECT mr.id AS review_id, mr.rating AS user_rating, mr.review,
        m.id, m.title, m.description, m.genre, m.rating AS movie_rating, m.release_year
       FROM movie_reviews mr
       INNER JOIN movies m ON m.id = mr.movie_id
       WHERE mr.user_id = $1
       ORDER BY mr.id DESC`,
      [authenticatedUser.userId]
    )

    sendJson(res, 200, {
      user: result.rows[0],
      favorites: favoritesResult.rows,
      reviews: reviewsResult.rows,
    })
  } catch (error) {
    console.error('Profile error:', error)
    sendJson(res, 500, { message: 'Failed to load profile.' })
  }
}

export async function handleUserRoutes(req, res, url) { // this is the router invoked from server.js 
  // User endpoint to fetch and display User Profile Details
  if (req.method === 'GET' && url.pathname === '/api/profile') {
    await handleUserProfile(req, res, url)
    return true
  }

  // User endpoint for adding a movie as user's favourite
  if (req.method === 'PUT' && /^\/api\/favorites\/\d+$/.test(url.pathname)) {
    await handleFavoriteToggle(req, res, url, true)
    return true
  }
  // User endpoint for removing a movie as user's favourite
  if (req.method === 'DELETE' && /^\/api\/favorites\/\d+$/.test(url.pathname)) {
    await handleFavoriteToggle(req, res, url, false)
    return true
  }

  // User Endpoint to submit user's movie review
  if (req.method === 'POST' && /^\/api\/movies\/\d+\/reviews$/.test(url.pathname)) {
    handleReviewSubmission(req, res, url)
    return true
  }

  return false
}
