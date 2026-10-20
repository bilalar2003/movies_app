import chalk from 'chalk'
import { pool } from '../config/db.js'
import { verifyToken } from '../middleware/auth.js'

const apiPrefix = '/api/admin/'

// method colors for logging on terminal
const methodColors = {
  GET: chalk.green,
  POST: chalk.yellow,
  PUT: chalk.blue,
  DELETE: chalk.red,
  PATCH: chalk.magenta,
}

// function to log api calls on terminal (with color)
const logRequest = (req, url) => {
  const colorFn = methodColors[req.method] || chalk.white
  console.log(`${colorFn(req.method)} ${url}`)
}

// same as before 
const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

// function to verify admin's accessToken on each API request 
const requireAdmin = (req, res) => {
  const authenticatedUser = verifyToken(req)

  if (!authenticatedUser) { // if token expired,
    // send 401: Unauthorized error
    sendJson(res, 401, { message: 'Authentication required.' })
    return null
  }

  if (authenticatedUser.role !== 'admin') {
    // 403: Forbidden, means you lack permission for requested functionality 
    sendJson(res, 403, { message: 'Admin access required.' })
    return null
  }

  return authenticatedUser
}

const handleAdminUsersList = async (req, res, url) => {
  logRequest(req, url)

  // check if accessToken is valid and if user has admin role 
  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  try {
    // fetch all user details from DB
    const result = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE role = 'user'
       ORDER BY id ASC`
    )

    sendJson(res, 200, { users: result.rows })
    // 200:OK meaning request was succesful, user data was set in response and sent. 
  } catch (error) {
    console.error('Admin users list error:', error)
    sendJson(res, 500, { message: 'Failed to load users.' })
    // 500 Internal Server Error if any error occurred 
  }
}

const handleAdminReviewsList = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  try {
    // fetch all movie reviews along with the user data who submitted the review 
    const result = await pool.query(
      `SELECT mr.id AS review_id, mr.rating, mr.review,
        u.name AS user_name, u.email AS user_email,
        m.id AS movie_id, m.title AS movie_title
       FROM movie_reviews mr
       INNER JOIN users u ON u.id = mr.user_id
       INNER JOIN movies m ON m.id = mr.movie_id
       ORDER BY mr.id DESC`
    )

    sendJson(res, 200, { reviews: result.rows })
  } catch (error) {
    console.error('Admin reviews list error:', error)
    sendJson(res, 500, { message: 'Failed to load reviews.' })
  }
}

export async function handleAdminRoutes(req, res, url) {
  
  // admin endpoint to retrieve all users registered in the app 
  if (req.method === 'GET' && url.pathname === `${apiPrefix}users`) {
    await handleAdminUsersList(req, res, url) // call function to handle API.
    return true // this is to tell server.js the endpoint was found and handled.
  }

  // admin endpoint to retrieve all movies reviews in app
  if (req.method === 'GET' && url.pathname === `${apiPrefix}reviews`) {
    await handleAdminReviewsList(req, res, url) // same. 
    return true // same. 
  }

  return false // if endpoint was not found in this file, return false to server.js
  // telling server.js the endpoint for API call wasn't found. 
}
