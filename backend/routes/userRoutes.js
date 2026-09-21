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

const requireMovieAccess = (req, res, invalidRoleStatus = 403) => {
  const authenticatedUser = verifyToken(req)

  if (!authenticatedUser) {
    sendJson(res, 401, { message: 'Authentication required.' })
    return null
  }

  if (!['user', 'admin'].includes(authenticatedUser.role)) {
    sendJson(
      res,
      invalidRoleStatus,
      invalidRoleStatus === 401
        ? { message: 'Authentication required.' }
        : { message: 'You are not authorized to view movies.' }
    )
    return null
  }

  return authenticatedUser
}

const handleMovieDetails = async (req, res, url) => {
  logRequest(req, url)

  if (!requireMovieAccess(req, res, 401)) {
    return
  }

  const movieId = Number.parseInt(url.pathname.split('/').pop(), 10)

  try {
    const result = await pool.query(
      'SELECT id, title, description, genre, rating, release_year FROM movies WHERE id = $1',
      [movieId]
    )

    if (result.rows.length === 0) {
      sendJson(res, 404, { message: 'Movie not found.' })
      return
    }

    sendJson(res, 200, { movie: result.rows[0] })
  } catch (error) {
    console.error('Movie details error:', error)
    sendJson(res, 500, { message: 'Failed to load movie details.' })
  }
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

const handleMovieList = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = verifyToken(req)

  if (!authenticatedUser) {
    sendJson(res, 401, { message: 'Authentication required.' })
    return
  }

  if (!['user', 'admin'].includes(authenticatedUser.role)) {
    sendJson(res, 403, { message: 'You are not authorized to view movies.' })
    return
  }

  const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10), 1)
  const firstPageLimit = 10
  const laterPageLimit = 10

  try {
    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM movies')
    const totalMovies = countResult.rows[0].total
    const totalPages = totalMovies <= firstPageLimit
      ? 1
      : 1 + Math.ceil((totalMovies - firstPageLimit) / laterPageLimit)
    const currentPage = Math.min(page, totalPages)
    const limit = currentPage === 1 ? firstPageLimit : laterPageLimit
    const offset = currentPage === 1
      ? 0
      : firstPageLimit + (currentPage - 2) * laterPageLimit
    const moviesResult = await pool.query(
      'SELECT id, title, description, genre, rating, release_year FROM movies ORDER BY id LIMIT $1 OFFSET $2',
      [limit, offset]
    )

    sendJson(res, 200, {
      movies: moviesResult.rows,
      page: currentPage,
      limit,
      offset,
      totalMovies,
      totalPages,
    })
  } catch (error) {
    console.error('Movies error:', error)
    sendJson(res, 500, { message: 'Failed to load movies.' })
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

    sendJson(res, 200, { user: result.rows[0] })
  } catch (error) {
    console.error('Profile error:', error)
    sendJson(res, 500, { message: 'Failed to load profile.' })
  }
}

export async function handleUserRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/profile') {
    await handleUserProfile(req, res, url)
    return true
  }

  // User Endpoint to fetch and show selected movie details
  if (req.method === 'GET' && /^\/api\/movies\/\d+$/.test(url.pathname)) {
    await handleMovieDetails(req, res, url)
    return true
  }
  // User Endpoint to submit user's movie review
  if (req.method === 'POST' && /^\/api\/movies\/\d+\/reviews$/.test(url.pathname)) {
    handleReviewSubmission(req, res, url)
    return true
  }
  // User Endpoint to fetch and display movies list to user
  if (req.method === 'GET' && url.pathname === '/api/movies') {
    await handleMovieList(req, res, url)
    return true
  }

  return false
}
