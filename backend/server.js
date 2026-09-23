import http from 'http';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import chalk from 'chalk'
import { handleUserRoutes } from './routes/userRoutes.js'
import { handleSharedRoutes } from './routes/sharedRoutes.js'
import { handleAdminRoutes } from './routes/adminRoutes.js'

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); // 
  const method = req.method ? req.method.toUpperCase() : 'GET'; // sets method to uppercase for consistency
  // defaults to GET if undefined

  // Skip this, it's just setting metadata for the response 
  // to allow cross-origin requests (CORS) and handle preflight requests
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // requests only from the url will be entertained
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // tells browser to allow credentials like cookies to be included in requests
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); // the HTTP methods client can include in its requests
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
        res.end(JSON.stringify({
          message: 'Sign-up successful. Please log in.',
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
        }));
      } catch (error) {
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
    const colorFn = methodColors[req.method] || chalk.white;
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
          res.end(JSON.stringify({ message: 'Email and password are required.' }));
          return;
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        if (!normalizedEmail || !String(password).trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Email and password are required.' }));
          return;
        }

        const result = await pool.query(
          'SELECT id, name, email, password, role FROM users WHERE email = $1',
          [normalizedEmail]
        );

        if (result.rows.length === 0) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Invalid email or password.' }));
          return;
        }

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Invalid email or password.' }));
          return;
        }

        const accessToken = jwt.sign(
          { userId: user.id, normalizedEmail, role: user.role },
          ACCESS_SECRET_KEY,
          { expiresIn: '15m' }
        )
        const refreshToken = jwt.sign(
          { userId: user.id, normalizedEmail },
          REFRESH_SECRET_KEY,
          { expiresIn: '7d' }
        )

        res.setHeader('Set-Cookie', `refreshToken=${refreshToken}; HttpOnly; Path=/api/refresh; Max-Age=604800; SameSite=Lax`)
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
  if (method === 'POST' && url.pathname === '/api/refresh') {
    const colorFn = methodColors[req.method] || chalk.white;
    console.log(`${colorFn(req.method)} ${url}`);

    const cookies = req.headers.cookie || '';
    const refreshToken = cookies
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('refreshToken='))
      ?.split('=')[1];

    if (!refreshToken) {
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

  if (await handleAdminRoutes(req, res, url)) {
    return;
  }

  if (await handleUserRoutes(req, res, url)) { // this is the router for user-specific endpoints
    return;
  }

  if (await handleSharedRoutes(req, res, url)) {
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