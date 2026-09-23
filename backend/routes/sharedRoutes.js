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

    const reviewsResult = await pool.query(
      `SELECT mr.id AS review_id, mr.rating AS user_rating, mr.review, u.name AS user_name
       FROM movie_reviews mr
       INNER JOIN users u ON u.id = mr.user_id
       WHERE mr.movie_id = $1
       ORDER BY mr.id DESC`,
      [movieId]
    )

    sendJson(res, 200, {
      movie: result.rows[0],
      reviews: reviewsResult.rows,
    })
  } catch (error) {
    console.error('Movie details error:', error)
    sendJson(res, 500, { message: 'Failed to load movie details.' })
  }
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

export async function handleSharedRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/movies') {
    await handleMovieList(req, res, url)
    return true
  }

  if (req.method === 'GET' && /^\/api\/movies\/\d+$/.test(url.pathname)) {
    await handleMovieDetails(req, res, url)
    return true
  }

  return false
}
