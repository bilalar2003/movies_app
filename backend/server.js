import http from 'http';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { refreshAccessToken, fetchProtected } from '../frontend/src/services/api.js';
import chalk from 'chalk'

dotenv.config();

const methodColors = {
  GET: chalk.green,
  POST: chalk.yellow,
  PUT: chalk.blue,
  DELETE: chalk.red,
  PATCH: chalk.magenta,
};

const PORT = process.env.PORT || 5000;
const ACCESS_SECRET_KEY = process.env.ACCESS_SECRET_KEY
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY

const checkDatabaseConnection = async () => {
  try {
    await pool.query('SELECT 1'); // this sends a simple query to the PG DB to check if connection is working
    return { connected: true, message: 'Database connected' };
  } catch (error) {
    return {
      connected: false,
      message: 'Database connection failed',
      error: error.message,
    };
  }
};

function verifyToken(req) { // this just extracts the accessToken from request object and verifies it. 
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return null

  const accessToken = authHeader.split(' ')[1] // extract accessToken from authHeader

  try {
    const decoded = jwt.verify(accessToken, ACCESS_SECRET_KEY); // jwt.verify() checks signature + expiry using the secret key
    return decoded; //  if token is valid then decoding is successful, we extract the payload { username, iat, exp }.
  } catch (err) {
    return null; // return null if invalid or expired.
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); // 
  const method = req.method ? req.method.toUpperCase() : 'GET'; // sets method to uppercase for consistency
  // defaults to GET if undefined

  // Skip this, it's just setting metadata for the response 
  // to allow cross-origin requests (CORS) and handle preflight requests
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // requests only from the url will be entertained
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // tells browser to allow credentials like cookies to be included in requests
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); // the HTTP methods client can include in their requests
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // allows client to send content-type and authorization headers in their requests

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // SignUp POST Endpoint (localhost:5000/api/signup)
  if (method === 'POST' && url.pathname === '/api/signup') {
    const colorFn = methodColors[req.method] || chalk.white; // For coloring method in console
    console.log(`${colorFn(req.method)} ${url}`);

    let body = ''; // this is the empty string that will hold the incoming data from the request

    req.on('data', (chunk) => {
      body += chunk;
    }); // this listens to the incoming data from the request, appends each chunk to the body 

    req.on('end', async () => { // once all data chunks have been received, the callback runs to process the body & handle signup logic
      try {
        const parsed = body ? JSON.parse(body) : {}; // this parses the body string into JS object (first checks if body isn't empty)
        const { name, email, password } = parsed; // splits the parsed object into individual variables for easier access

        if (!name || !email || !password) { // returns error message if any required field(s) is missing (this is data validation)
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Name, email, and password are required.',
          }));
          return;
        }

        const normalizedEmail = String(email).trim().toLowerCase(); // this trims whitespace and converts email to lowercase for consistency 
        const normalizedName = String(name).trim(); // this removes whitespace from the name for consistency

        if (!normalizedEmail || !normalizedName || !String(password).trim()) { // Ensures fields are not empty spaces after trimming
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Name, email, and password are required.',
          }));
          return;
        }

        if (String(password).length < 5 || !/[^A-Za-z0-9\s]/.test(String(password))) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Password must be at least 5 characters long and include at least one special character.',
          }));
          return;
        }

        const existingUser = await pool.query(  // this checks if a user with the same email already exists in the database
          'SELECT id FROM users WHERE email = $1',
          [normalizedEmail]
        );

        if (existingUser.rows.length > 0) { // this returns error message if user with same email address already exists in DB
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'An account with this email already exists.',
          }));
          return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
          "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user') RETURNING id, name, email, role",
          [normalizedName, normalizedEmail, hashedPassword]
        ); // this registers user into the database
        // also returning the newly created user's id, name, and email for confirmation

        const user = result.rows[0]; // this retrieves the newly created user from the result of the INSERT query

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ // returns success message with user info
          message: 'Sign-up successful. Please log in.',
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
        }));
      } catch (error) { // runs in case if an error occurs during signup process 
        if (error?.code === '23505' || /duplicate key|already exists/i.test(error?.message || '')) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'An account with this email already exists.' }));
          return;
        }

        console.error('Signup error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Failed to create user account.' }));
      }
    });
    return;
  }

  // Login POST Endpoint (localhost:5000/api/login)
  if (method === 'POST' && url.pathname === '/api/login') {
    const colorFn = methodColors[req.method] || chalk.white; // For coloring method in console
    console.log(`${colorFn(req.method)} ${url}`);

    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const { email, password } = parsed;

        if (!email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Email and password are required.',
          }));
          return;
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        if (!normalizedEmail || !String(password).trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Email and password are required.',
          }));
          return;
        }

        const result = await pool.query(
          'SELECT id, name, email, password, role FROM users WHERE email = $1',
          [normalizedEmail]
        );

        if (result.rows.length === 0) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Invalid email or password.',
          }));
          return;
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Invalid email or password.',
          }));
          return;
        }

        const accessToken = jwt.sign( // JWT Token sign() added here. 
          { userId: user.id, normalizedEmail, role: user.role },
          ACCESS_SECRET_KEY, 
          { expiresIn: '15m' }
        )

        const refreshToken = jwt.sign(
          { userId: user.id, normalizedEmail }, 
          REFRESH_SECRET_KEY,
          { expiresIn: '7d'}
        )

        res.setHeader('Set-Cookie', `refreshToken=${refreshToken}; HttpOnly; Path=/api/refresh; Max-Age=604800; SameSite=Lax`)
        // Above line sets an HttpOnly, 7-day secure cookie named refreshToken on the browser 
        // that will only be sent with requests made to the /api/refresh path.
        // Note: the refreshToken is sent to the client as HttpOnly cookie (this is standard practice).
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Login successful.',
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
          accessToken, 
        }));
      } catch (error) {
        console.error('Login error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Failed to log in.' }));
      }
    });
    return;
  }

  // RefreshToken Endpoint (localhost:5000/api/refresh)
  // runs when access token has expired and browser requests this endpoint for a new accessToken
  // this route runs automatically by browser upon an accessToken expiring.
  if (method === 'POST' && url.pathname === '/api/refresh') {
    const colorFn = methodColors[req.method] || chalk.white; // For coloring method in console
    console.log(`${colorFn(req.method)} ${url}`);

    const cookies = req.headers.cookie || ''; // this is how we extract cookie from client request
    const refreshToken = cookies 
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('refreshToken='))
      ?.split('=')[1]; // then we extract the refreshToken from the cookie

    if (!refreshToken) { // return error message if refreshToken is missing 
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Refresh token missing.' }));
      return;
    }

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY); 
      const result = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'User not found.' }));
        return;
      }

      const user = result.rows[0];
      const accessToken = jwt.sign(
        { userId: user.id, normalizedEmail: user.email, role: user.role },
        ACCESS_SECRET_KEY,
        { expiresIn: '15m' }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accessToken }));
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Invalid or expired refresh token.' }));
    }

    return;
  }

  // Logout endpoint: expire the refresh token cookie in the browser.
  if (method === 'POST' && url.pathname === '/api/logout') {
    const colorFn = methodColors[req.method] || chalk.white; // For coloring method in console
    console.log(`${colorFn(req.method)} ${url}`);

    res.setHeader('Set-Cookie', 'refreshToken=; HttpOnly; Path=/api/refresh; Max-Age=0; SameSite=Lax'); // this line expires the existing refreshToken
    res.writeHead(204);
    res.end();
    return;
  }

  // Movie details endpoint for authenticated users.
  if (method === 'GET' && /^\/api\/movies\/\d+$/.test(url.pathname)) {
    const colorFn = methodColors[req.method] || chalk.white;
    console.log(`${colorFn(req.method)} ${url}`);

    const authenticatedUser = verifyToken(req);

    if (!authenticatedUser || !['user', 'admin'].includes(authenticatedUser.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Authentication required.' }));
      return;
    }

    const movieId = Number.parseInt(url.pathname.split('/').pop(), 10);

    try {
      const result = await pool.query(
        'SELECT id, title, description, genre, rating, release_year FROM movies WHERE id = $1',
        [movieId]
      );

      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Movie not found.' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ movie: result.rows[0] }));
    } catch (error) {
      console.error('Movie details error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Failed to load movie details.' }));
    }
    return;
  }

  // Review submission endpoint for authenticated users.
  if (method === 'POST' && /^\/api\/movies\/\d+\/reviews$/.test(url.pathname)) {
    const colorFn = methodColors[req.method] || chalk.white;
    console.log(`${colorFn(req.method)} ${url}`);

    const authenticatedUser = verifyToken(req);

    if (!authenticatedUser) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Authentication required.' }));
      return;
    }

    if (authenticatedUser.role !== 'user') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Only users can submit reviews.' }));
      return;
    }

    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const rating = Number(parsed.rating);
        const review = typeof parsed.review === 'string' ? parsed.review.trim() : '';
        const movieId = Number.parseInt(url.pathname.split('/')[3], 10);

        if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !review) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'A rating from 1 to 5 and a review are required.',
          }));
          return;
        }

        const result = await pool.query(
          'INSERT INTO movie_reviews (user_id, movie_id, rating, review) VALUES ($1, $2, $3, $4) RETURNING id, movie_id, rating, review',
          [authenticatedUser.userId, movieId, rating, review]
        );

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Review submitted successfully.',
          review: result.rows[0],
        }));
      } catch (error) {
        if (error?.code === '23503') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Movie not found.' }));
          return;
        }

        console.error('Review submission error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Failed to submit review.' }));
      }
    });
    return;
  }
  
  // below is the endpoint for getting all movies on the homepage, after user logged in and moved to homepage. 
  if (method === 'GET' && url.pathname === '/api/movies') {
    const colorFn = methodColors[req.method] || chalk.white; // For coloring method in console
    console.log(`${colorFn(req.method)} ${url}`);
    
    const authenticatedUser = verifyToken(req);

    if (!authenticatedUser) { // return error if access token is missing or expired. 
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Authentication required.' }));
      return;
    }

    // THIS IS WHERE AUTHORISATION TAKES PLACE
    if (!['user', 'admin'].includes(authenticatedUser.role)) { // if not user or admin role, send authorisation error
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'You are not authorized to view movies.' }));
      return;
    } // user won't be able to view movies as they aren't authorised.

    const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10), 1);
    const firstPageLimit = 10;
    const laterPageLimit = 10;

    try { // simply fetch movies from database
      const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM movies');
      const totalMovies = countResult.rows[0].total;
      const totalPages = totalMovies <= firstPageLimit
        ? 1
        : 1 + Math.ceil((totalMovies - firstPageLimit) / laterPageLimit);
      const currentPage = Math.min(page, totalPages);
      const limit = currentPage === 1 ? firstPageLimit : laterPageLimit;
      const offset = currentPage === 1
        ? 0
        : firstPageLimit + (currentPage - 2) * laterPageLimit;
      const moviesResult = await pool.query(
        'SELECT id, title, description, genre, rating, release_year FROM movies ORDER BY id LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        movies: moviesResult.rows,
        page: currentPage,
        limit,
        offset,
        totalMovies,
        totalPages,
      })); // send response object with movies result
    } catch (error) {
      console.error('Movies error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Failed to load movies.' }));
    }
    return;
  }

  // Runs if an undefined route is requested by client. 
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Route not found' })); // runs if request doesn't match any defined route
});

// Server listens to specified port (i.e 5000)
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 