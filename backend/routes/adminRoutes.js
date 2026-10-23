import chalk from 'chalk'
import bcrypt from 'bcrypt'
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

const handleAdminUserCreate = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })

  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {}
      const normalizedName = String(parsed.name ?? '').trim()
      const normalizedEmail = String(parsed.email ?? '').trim().toLowerCase()
      const normalizedPassword = String(parsed.password ?? '')

      if (!normalizedName || !normalizedEmail || !normalizedPassword) {
        sendJson(res, 400, { message: 'Name, email, and password are required.' })
        return
      }

      if (normalizedPassword.length < 5 || !/[^A-Za-z0-9\s]/.test(normalizedPassword)) {
        sendJson(res, 400, {
          message: 'Password must be at least 5 characters long and include at least one special character.',
        })
        return
      }

      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [normalizedEmail]
      )

      if (existingUser.rows.length > 0) {
        sendJson(res, 409, { message: 'An account with this email already exists.' })
        return
      }

      const hashedPassword = await bcrypt.hash(normalizedPassword, 12)
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user')",
        [normalizedName, normalizedEmail, hashedPassword]
      )

      sendJson(res, 201, { message: 'User created successfully.' })
    } catch (error) {
      if (error.code === '23505') {
        sendJson(res, 409, { message: 'An account with this email already exists.' })
        return
      }

      console.error('Admin user creation error:', error)
      sendJson(res, 500, { message: 'Failed to create user.' })
    }
  })
}

const handleAdminUserDelete = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  const userId = Number(url.pathname.split('/').pop())

  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 AND role = 'user' RETURNING id",
      [userId]
    )

    if (result.rows.length === 0) {
      sendJson(res, 404, { message: 'User not found.' })
      return
    }

    sendJson(res, 200, { message: 'User removed successfully.' })
  } catch (error) {
    console.error('Admin user deletion error:', error)
    sendJson(res, 500, { message: 'Failed to remove user.' })
  }
}

const handleAdminUserUpdate = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  const userId = Number(url.pathname.split('/').pop())
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })

  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {}
      const updates = {}

      if (Object.hasOwn(parsed, 'name')) {
        const name = String(parsed.name ?? '').trim()
        if (!name) {
          sendJson(res, 400, { message: 'Name is required.' })
          return
        }
        updates.name = name
      }

      if (Object.hasOwn(parsed, 'email')) {
        const email = String(parsed.email ?? '').trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          sendJson(res, 400, { message: 'A valid email address is required.' })
          return
        }
        updates.email = email
      }

      if (Object.hasOwn(parsed, 'password') && parsed.password) {
        const password = String(parsed.password)
        if (password.length < 5 || !/[^A-Za-z0-9\s]/.test(password)) {
          sendJson(res, 400, {
            message: 'Password must be at least 5 characters long and include at least one special character.',
          })
          return
        }
        updates.password = await bcrypt.hash(password, 12)
      }

      const fields = Object.keys(updates)
      if (fields.length === 0) {
        sendJson(res, 400, { message: 'No user details were provided to update.' })
        return
      }

      const values = Object.values(updates)
      const assignments = fields.map((field, index) => `${field} = $${index + 1}`)
      values.push(userId)
      const result = await pool.query(
        `UPDATE users SET ${assignments.join(', ')}
         WHERE id = $${values.length} AND role = 'user'
         RETURNING id, name, email, role`,
        values
      )

      if (result.rows.length === 0) {
        sendJson(res, 404, { message: 'User not found.' })
        return
      }

      sendJson(res, 200, { message: 'User updated successfully.', user: result.rows[0] })
    } catch (error) {
      if (error.code === '23505') {
        sendJson(res, 409, { message: 'An account with this email already exists.' })
        return
      }

      console.error('Admin user update error:', error)
      sendJson(res, 500, { message: 'Failed to update user.' })
    }
  })
}

const handleAdminMovieDelete = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  const movieId = Number(url.pathname.split('/').pop())

  try {
    const result = await pool.query(
      'DELETE FROM movies WHERE id = $1 RETURNING id',
      [movieId]
    )

    if (result.rows.length === 0) {
      sendJson(res, 404, { message: 'Movie not found.' })
      return
    }

    sendJson(res, 200, { message: 'Movie removed successfully.' })
  } catch (error) {
    console.error('Admin movie deletion error:', error)
    sendJson(res, 500, { message: 'Failed to remove movie.' })
  }
}

const handleAdminMovieUpdate = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  const movieId = Number(url.pathname.split('/').pop())
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })

  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {}
      const updates = {}

      if (Object.hasOwn(parsed, 'title')) {
        const title = String(parsed.title ?? '').trim()
        if (!title) {
          sendJson(res, 400, { message: 'Movie title is required.' })
          return
        }
        updates.title = title
      }

      for (const field of ['description', 'genre']) {
        if (Object.hasOwn(parsed, field)) {
          updates[field] = String(parsed[field] ?? '').trim()
        }
      }

      if (Object.hasOwn(parsed, 'rating')) {
        const ratingValue = String(parsed.rating ?? '').trim()
        if (ratingValue && !/^(?:10|[0-9])\.[0-9]$/.test(ratingValue)) {
          sendJson(res, 400, { message: 'Rating must use X.X format, from 0.0 to 10.0.' })
          return
        }
        updates.rating = ratingValue ? Number(ratingValue) : null
      }

      if (Object.hasOwn(parsed, 'release_year')) {
        const releaseYearValue = String(parsed.release_year ?? '').trim()
        const releaseYear = releaseYearValue ? Number(releaseYearValue) : null
        if (releaseYear !== null && (!Number.isInteger(releaseYear) || releaseYear < 1888 || releaseYear > 9999)) {
          sendJson(res, 400, { message: 'Release year must be a valid year between 1888 and 9999.' })
          return
        }
        updates.release_year = releaseYear
      }

      const fields = Object.keys(updates)
      if (fields.length === 0) {
        sendJson(res, 400, { message: 'No movie details were provided to update.' })
        return
      }

      const values = Object.values(updates)
      const assignments = fields.map((field, index) => `${field} = $${index + 1}`)
      values.push(movieId)
      const result = await pool.query(
        `UPDATE movies SET ${assignments.join(', ')}
         WHERE id = $${values.length}
         RETURNING id, title, description, genre, rating, release_year`,
        values
      )

      if (result.rows.length === 0) {
        sendJson(res, 404, { message: 'Movie not found.' })
        return
      }

      sendJson(res, 200, { message: 'Movie updated successfully.', movie: result.rows[0] })
    } catch (error) {
      console.error('Admin movie update error:', error)
      sendJson(res, 500, { message: 'Failed to update movie.' })
    }
  })
}

const handleAdminReviewDelete = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  const reviewId = Number(url.pathname.split('/').pop())

  try {
    const result = await pool.query(
      'DELETE FROM movie_reviews WHERE id = $1 RETURNING id',
      [reviewId]
    )

    if (result.rows.length === 0) {
      sendJson(res, 404, { message: 'Review not found.' })
      return
    }

    sendJson(res, 200, { message: 'Review removed successfully.' })
  } catch (error) {
    console.error('Admin review deletion error:', error)
    sendJson(res, 500, { message: 'Failed to remove review.' })
  }
}

const handleAdminReviewUpdate = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  const reviewId = Number(url.pathname.split('/').pop())
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })

  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {}
      const updates = {}

      if (Object.hasOwn(parsed, 'rating')) {
        const rating = Number(parsed.rating)
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          sendJson(res, 400, { message: 'Review rating must be between 1 and 5.' })
          return
        }
        updates.rating = rating
      }

      if (Object.hasOwn(parsed, 'review')) {
        const review = String(parsed.review ?? '')
        if (!review.trim()) {
          sendJson(res, 400, { message: 'Review text is required.' })
          return
        }
        updates.review = review
      }

      const fields = Object.keys(updates)
      if (fields.length === 0) {
        sendJson(res, 400, { message: 'No review details were provided to update.' })
        return
      }

      const values = Object.values(updates)
      const assignments = fields.map((field, index) => `${field} = $${index + 1}`)
      values.push(reviewId)
      const result = await pool.query(
        `UPDATE movie_reviews SET ${assignments.join(', ')}
         WHERE id = $${values.length}
         RETURNING id`,
        values
      )

      if (result.rows.length === 0) {
        sendJson(res, 404, { message: 'Review not found.' })
        return
      }

      const reviewResult = await pool.query(
        `SELECT mr.id AS review_id, mr.rating, mr.review,
          u.name AS user_name, u.email AS user_email,
          m.id AS movie_id, m.title AS movie_title
         FROM movie_reviews mr
         INNER JOIN users u ON u.id = mr.user_id
         INNER JOIN movies m ON m.id = mr.movie_id
         WHERE mr.id = $1`,
        [reviewId]
      )

      sendJson(res, 200, {
        message: 'Review updated successfully.',
        review: reviewResult.rows[0],
      })
    } catch (error) {
      console.error('Admin review update error:', error)
      sendJson(res, 500, { message: 'Failed to update review.' })
    }
  })
}

const handleAdminMovieCreate = async (req, res, url) => {
  logRequest(req, url)

  const authenticatedUser = requireAdmin(req, res)
  if (!authenticatedUser) {
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })

  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {}
      const title = String(parsed.title ?? '').trim()
      const description = String(parsed.description ?? '').trim()
      const genre = String(parsed.genre ?? '').trim()
      const releaseYearValue = String(parsed.release_year ?? '').trim()
      const ratingValue = String(parsed.rating ?? '').trim()
      const ratingFormat = /^(?:10|[0-9])\.[0-9]$/

      if (!title || !description || !genre || !releaseYearValue || !ratingValue) {
        sendJson(res, 400, { message: 'Title, description, genre, release year, and rating are required.' })
        return
      }

      if (!ratingFormat.test(ratingValue)) {
        sendJson(res, 400, { message: 'Rating must use X.X format, from 0.0 to 10.0.' })
        return
      }

      const releaseYear = Number(releaseYearValue)
      const rating = Number(ratingValue)

      if (!Number.isInteger(releaseYear) || releaseYear < 1888 || releaseYear > 9999) {
        sendJson(res, 400, { message: 'Release year must be a valid year between 1888 and 9999.' })
        return
      }

      if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
        sendJson(res, 400, { message: 'Rating must be between 0 and 10.' })
        return
      }

      const result = await pool.query(
        `INSERT INTO movies (title, description, genre, rating, release_year)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, genre, rating, release_year`,
        [title, description, genre, rating, releaseYear]
      )

      sendJson(res, 201, {
        message: 'Movie created successfully.',
        movie: result.rows[0],
      })
    } catch (error) {
      console.error('Admin movie creation error:', error)
      sendJson(res, 500, { message: 'Failed to create movie.' })
    }
  })
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
  
  if (req.method === 'PATCH' && new RegExp(`^${apiPrefix}users/\\d+$`).test(url.pathname)) {
    await handleAdminUserUpdate(req, res, url)
    return true
  }

  if (req.method === 'PATCH' && new RegExp(`^${apiPrefix}movies/\\d+$`).test(url.pathname)) {
    await handleAdminMovieUpdate(req, res, url)
    return true
  }

  if (req.method === 'PATCH' && new RegExp(`^${apiPrefix}reviews/\\d+$`).test(url.pathname)) {
    await handleAdminReviewUpdate(req, res, url)
    return true
  }

  if (req.method === 'DELETE' && new RegExp(`^${apiPrefix}users/\\d+$`).test(url.pathname)) {
    await handleAdminUserDelete(req, res, url)
    return true
  }

  if (req.method === 'DELETE' && new RegExp(`^${apiPrefix}movies/\\d+$`).test(url.pathname)) {
    await handleAdminMovieDelete(req, res, url)
    return true
  }

  if (req.method === 'DELETE' && new RegExp(`^${apiPrefix}reviews/\\d+$`).test(url.pathname)) {
    await handleAdminReviewDelete(req, res, url)
    return true
  }

  if (req.method === 'POST' && url.pathname === `${apiPrefix}movies`) {
    await handleAdminMovieCreate(req, res, url)
    return true
  }

  if (req.method === 'POST' && url.pathname === `${apiPrefix}users`) {
    await handleAdminUserCreate(req, res, url)
    return true
  }
  
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
