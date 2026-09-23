import chalk from 'chalk'
import { pool } from '../config/db.js'
import { verifyToken } from '../middleware/auth.js'

const methodColors = {
  GET: chalk.green,
  POST: chalk.yellow,
  PUT: chalk.blue,
  DELETE: chalk.red,
  PATCH: chalk.magenta,
}

const logRequest = (req, url) => {
  const colorFn = methodColors[req.method] || chalk.white
  console.log(`${colorFn(req.method)} ${url}`)
}

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

const requireAdmin = (req, res) => {
  const authenticatedUser = verifyToken(req)

  if (!authenticatedUser) {
    sendJson(res, 401, { message: 'Authentication required.' })
    return null
  }

  if (authenticatedUser.role !== 'admin') {
    sendJson(res, 403, { message: 'Admin access required.' })
    return null
  }

  return authenticatedUser
}

const handleUsersList = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE role = 'user'
       ORDER BY id ASC`
    )

    sendJson(res, 200, { users: result.rows })
  } catch (error) {
    console.error('Admin users list error:', error)
    sendJson(res, 500, { message: 'Failed to load users.' })
  }
}

const handleAdminMoviesList = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10), 1)
  const limit = 10

  try {
    const totalResult = await pool.query('SELECT COUNT(*)::int AS total FROM movies')
    const totalMovies = totalResult.rows[0].total
    const totalPages = Math.max(1, Math.ceil(totalMovies / limit))
    const currentPage = Math.min(page, totalPages)
    const offset = (currentPage - 1) * limit

    const result = await pool.query(
      `SELECT id, title, description, genre, rating, release_year
       FROM movies
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    sendJson(res, 200, {
      movies: result.rows,
      page: currentPage,
      totalPages,
      totalMovies,
      limit,
    })
  } catch (error) {
    console.error('Admin movies list error:', error)
    sendJson(res, 500, { message: 'Failed to load movies.' })
  }
}

export async function handleAdminRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/admin/users') {
    await handleUsersList(req, res, url)
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/movies') {
    await handleAdminMoviesList(req, res, url)
    return true
  }

  return false
}
