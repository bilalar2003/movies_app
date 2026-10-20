import http from 'http';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import chalk from 'chalk'
import { handleUserRoutes } from './routes/userRoutes.js'
import { handleSharedRoutes } from './routes/sharedRoutes.js'
import { handleAdminRoutes } from './routes/adminRoutes.js'

dotenv.config(); // dotenv is the library we import,
// config() is the function that reads key-value pairs from our.env file 
// and stores them in process.env,
// so we can access them in our code.

const methodColors = {
  GET: chalk.green,
  POST: chalk.yellow,
  PUT: chalk.blue,
  DELETE: chalk.red,
  PATCH: chalk.magenta,
}; // chalk is package/library that adds colors to text printed in terminal. 
// This object maps HTTP methods to specific colors, 
// for better visibility in logs.

// below is simply loading env vairables here in this file.
const PORT = process.env.PORT || 5000;
const ACCESS_SECRET_KEY = process.env.ACCESS_SECRET_KEY
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY

const ApiPrefix = '/api/'

const logRequest = (req, url) => {
  const colorFn = methodColors[req.method] || chalk.white
  console.log(`${colorFn(req.method)} ${url}`)
}

// Using Node's HTTP module to set up server.
const server = http.createServer(async (req, res) => {
  // this builds full url object from req object's relative path,
  // relative path is like '/api/login', so req.url holds '/api/login'
  // req.headers.host holds value 'localhost:4000'
  // GO TO BOTTOM OF THIS PAGE TO SEE FULL URL OBJECT STRUCTURE
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const method = req.method ? req.method.toUpperCase() : 'GET'; // this sets method's value to one in req obj.

  // Below is setting metadata for our response (that we send back to frontend) 
  // to allow cross-origin requests (CORS)

  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // requests only from this url will be entertained, * would mean from any url.
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // tells browser to allow sending cookies in the response object.
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); // sets HTTP methods client can include in its requests.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // allows client to send content-type and authorization headers in their requests.

  // Below is a preflight request;
  // It's an automatic OPTIONS request the browser sends,
  // before actual requests.
  // Used to ask server if the actual request is allowed. 

  // ie: The preflight is just a permission check (OPTIONS) the browser sends first, 
  // and only if the server replies that it’s allowed, does the browser send the real request.

  // Note: The browser sends preflight request, when it's allowed, 
  // then actual request is sent which is resolved & promise is returned by server, 
  // Returning control to browser. 

  if (method === 'OPTIONS') {
    res.writeHead(204); // 204 is No Content, ie req. is successful with no data to send back as response.
    res.end();
    return;
  }

  // NOTE: All above code runs each time a request is made. 

  // SignUp POST Endpoint (localhost:5000/api/signup)
  if (method === 'POST' && url.pathname === `${ApiPrefix}signup`) {
    // Below, methodColors[req.method] fetches color for the req method.
    // Else, white if specified one isn't in the methodColors object.
    logRequest(req, url) // Print request in colored form.

    // this is the empty string that holds the incoming data from the request
    let body = '';
    // in Node’s http module the request body arrives as a stream of chunks,

    // this is event listener on 'request stream'.
    // it runs the callback each time a new body chunk arrives, 
    // appending it to body.
    req.on('data', (chunk) => { // here, 'data' is event name, that indicates a chunk arrived.
      body += chunk;
    });
    //NOTE: A request stream is Node’s way of delivering 
    // an incoming request body piece by piece 
    // instead of all at once,
    // common event names are data, end: all chunks arrived, error: reading failed, and close: close connection.

    req.on('end', async () => { // once all data chunks have been received, 
      // the callback runs to process the body & handle signup logic
      try {
        const parsed = body ? JSON.parse(body) : {}; // this parses the body string into JS object 
        // (first checks if body isn't empty)
        // Note: the data types of fields in payload are regained back after parsing.
        const { name, email, password } = parsed;
        // splits the parsed object into individual variables for easier access

        // NOTE: HTTP transmits data only in text,
        // So stringify() converts our req./res. object's 'BODY' into JSON string.
        // e.g for body of login request, the JSON string will be: 
        // {"email":"123@example.com","password":"12345"} 

        // Below is data validation:
        const normalizedName = String(name ?? '').trim() 
        // ?? means to keep value on its left if variable isn't missing, else use right one.
        const normalizedEmail = String(email ?? '').trim().toLowerCase()
        const normalizedPassword = String(password ?? '')
        // trim() removes spaces from start & end of string.
        // Note: we use String() to confirm the name, email, password are in string data type.
        // This is as user can send a number or a list instead. 

        if (!normalizedName || !normalizedEmail || !normalizedPassword) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          // 400: Bad request means server rejected the request
          // as the sent data is invalid or incomplete.
          res.end(JSON.stringify({
            message: 'Name, email, and password are required.',
          }));
          return;
        }

        if (normalizedPassword.length < 5 || !/[^A-Za-z0-9\s]/.test(normalizedPassword)) {
          res.writeHead(400, { 'Content-Type': 'application/json' }); 
          // 400 Bad Request, invalid password entered.
          res.end(JSON.stringify({
            message: 'Password must be at least 5 characters long and include at least one special character.',
          }));
          return;
        }

        // this checks if a user with the same email already exists in DB.
        // this sends mentioned SQL command to our posgtgres DB.
        // and [] array has values that safely fills the $ placeholders in the sql command. 
        const existingUser = await pool.query( 
          'SELECT id FROM users WHERE email = $1',
          [normalizedEmail]
        ); // this actually omits sql injection risk.
        // as SQL and values are seperately sent to DB,
        // where values are then plugged in as plain data
        // so input like ' OR 1=1 --' will be treated as email string,
        // instead of an operation. 
        if (existingUser.rows.length > 0) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          // 409 Conflict: means request couldn't be completed due to duplicate resource
          res.end(JSON.stringify({
            message: 'An account with this email already exists.',
          }));
          return;
        }

        // bcrypt is library, converts password into hash, so DB doesn't store actual password.
        const hashedPassword = await bcrypt.hash(normalizedPassword, 12);
        // 12 is salt rounds, it controls how slow hashing is. Greater value, slower hashing, 
        // makes it more difficult to guess password for attackers. 
        // salt is a random string bcrypt mixes into password before hashing.
        // so two users with same password get different hashes,
        // bcrypt creates salt automatically, stores it in final hash. 
        // It creates new salt for each hashing. 
        await pool.query(
          "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user')",
          [normalizedName, normalizedEmail, hashedPassword]
        ); // this registers user into the database.

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ // 201: Created. Means request was successful & new resource was created. 
          message: 'Sign-up successful. Please log in.'
        }));
      } catch (error) { // NOTE: this can run even if try block didnt throw error
        // like pool.query() fail can run it,
        // json.parse() fail, bcrypt.hash() fail can also run it.

        console.error('Signup error:', error); // this shows error on terminal.
        res.writeHead(500, { 'Content-Type': 'application/json' });
        // 500: Internal Server Error, means something went wrong on server side. 
        res.end(JSON.stringify({ message: 'Failed to create user account.' }));
      }
    });
    return;
  }

  // Login POST Endpoint (localhost:5000/api/login)
  if (method === 'POST' && url.pathname === `${ApiPrefix}login`) {
    logRequest(req, url)

    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const { email, password } = parsed;

        const normalizedEmail = String(email).trim().toLowerCase();
        const normalizedPassword = String(password);

        if (!normalizedEmail || !normalizedPassword) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          // 400: Bad Request, user sent incomplete data. 
          res.end(JSON.stringify({ message: 'Email and password are required.' }));
          return;
        }

        const result = await pool.query(
          'SELECT id, name, email, password, role FROM users WHERE email = $1',
          [normalizedEmail]
        );

        if (result.rows.length === 0) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          // 401: Unauthorized. Means that user couldn't be authorized. 
          // due to wrong email or password. 
          res.end(JSON.stringify({ message: 'Invalid email or password.' }));
          return;
        }

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(normalizedPassword, user.password);
        // above, bcrypt.compare() reads the salt and cost factor stored inside the saved hash (user.password)
        // hashes the normalizedPassword using this same cost factor and salt
        // then compares if they're same.

        if (!passwordMatches) { // send error if not same.
          res.writeHead(401, { 'Content-Type': 'application/json' });
          //401: Unauthorized. Invalid details entered. 
          res.end(JSON.stringify({ message: 'Invalid email or password.' }));
          return;
        }

        // This accessToken lets user access protected APIs for 15 minutes before it expires.
        const accessToken = jwt.sign( // token has 3 parts: Header, Payload, Signature.
          // Header specifies algorithm that's used to sign the token.
          // below stores specified payload inside the created accessToken.
          // NOTE: Encoded Header + Encrypted Payload + Secret Key = Digital Signature. 
          { userId: user.id, normalizedEmail, role: user.role },
          // below is a private key that is used to sign the token,
          // this is so that it hasn't been tampered with.
          ACCESS_SECRET_KEY,
          // duration for accessing a protected API.
          { expiresIn: '15m' }
        )
        // refreshToken lets user get a new access token without logging in again.
        const refreshToken = jwt.sign(
          { userId: user.id, normalizedEmail },
          REFRESH_SECRET_KEY,
          { expiresIn: '7d' }
        )
        
        // NOTE :
        // Step 1: When creating a token, jwt.sign() uses the secret key to generate a digital signature,
        // based on the token's data (the signature is itself stored in the token's Signature part).
        // Step 2: When the token arrives, 
        // jwt.verify(token, SECRET_KEY) uses the same secret key to check whether the signature is valid.
        // by recalculating the digital signature and comparing it with the existing one.
        // Step 3: If someone changes the token's data, 
        // the signature no longer matches, so verification fails and the server rejects the token.

        res.setHeader('Set-Cookie', `refreshToken=${refreshToken}; HttpOnly; Path=/api/refresh; Max-Age=604800; SameSite=Lax`)
        // above, setHeader sets an http response header,
        // 'Set-Cookie' tells browser to store a cookie in response objects. 
        // refreshToken: this line sets cookie name and its value (refreshToken).
        // HttpOnly: Prevents JavaScript from accessing the cookie.
        // Path=/api/refresh: Sends the cookie only to requests whose URL path matches '/api/refresh'
        // Max-Age=604800: Makes the cookie expire after 604,800 seconds (7 days).
        // SameSite=Lax: Prevents the browser from sending the cookie with most requests coming from other websites, 
        // helping protect your account from CSRF attacks.
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // 200:OK, request was successful and server returned requested response. 
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
  if (method === 'POST' && url.pathname === `${ApiPrefix}refresh`) {
    logRequest(req, url)

    const cookies = req.headers.cookie || ''; // extract raw cookie string from request object.
    const refreshToken = cookies
      .split(';') // split each key-value pair in the cookie string
      .map((cookie) => cookie.trim()) // remove whitespace from each pair
      .find((cookie) => cookie.startsWith('refreshToken=')) // find pair starting with refreshToken in it
      ?.split('=')[1]; // split and pick second element, the refreshToken actually

    if (!refreshToken) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Refresh token missing.' }));
      return;
    }

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY); // verify refreshToken by comparing digital signatures
      const result = await pool.query( // extract user info using userId from decoded object returnred from 
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [decoded.userId]
      );
      // returns decoded object: 
      // {userId, normalizedEmail, role, iat, exp}. iat and exp are automatically added by JWT.
      // Note that userId, normalizedEmail, and role were payload fields explicitly signed 
      // by jwt.sign() method at the time of user logging in. 
      if (result.rows.length === 0) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'User not found.' }));
        return;
      }
      // NOTE: both blocks above are a check to ensure that user is registered in the app's DB
      const user = result.rows[0];
      const accessToken = jwt.sign(
        { userId: user.id, normalizedEmail: user.email, role: user.role },
        ACCESS_SECRET_KEY,
        { expiresIn: '15m' }
      );
      // above creates a new accessToken for API calls       
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accessToken })); // new accessToken sent back. 
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Invalid or expired refresh token.' })); // send error if refreshToken expired
    }
    return;
  }

  // Logout endpoint: expire the refresh token cookie in the browser.
  if (method === 'POST' && url.pathname === `${ApiPrefix}logout`) {
    logRequest(req, url)

    res.setHeader('Set-Cookie', 'refreshToken=; HttpOnly; Path=/api/refresh; Max-Age=0; SameSite=Lax'); // this line expires the existing refreshToken.
    res.writeHead(204); // 204 No Content: means request succeeded but server has no content to send back.
    res.end();
    return;
  }

  // this is router for admin-specific endpoints
  // first, handleAdminRoutes runs in AdminRoutes.js, if the endpoint isn't found there,
  // then that returns false. 
  // else if found, the api call is handled there. 
  if (await handleAdminRoutes(req, res, url)) { 
    return;
  }

  // this is the router for user-specific endpoints,
  // same case here, api call is searched in UserRoutes.js file,
  // if not found, then returned, else handled. 
  if (await handleUserRoutes(req, res, url)) { 
    return;
  }

  // router for shared endpoints,
  // same flow here as of above if blocks. 
  if (await handleSharedRoutes(req, res, url)) { 
    return;
  }

  // Runs if an undefined route is requested by client. 
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Route not found' })); // runs if request doesn't match any defined route
});

// We activate our server to listen on port number, 
// that is 4000 as set in .env file. 
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 

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

// 400 Bad Request: the request is rejected as it contains invalid data
// 401 Unauthorized: user couldn't be authorised due to wrong email or password 
// 403 Forbidden: you’re authenticated but don’t have permission (RBAC)
// 404 Not Found: the requested resource doesn’t exist
// 405 Method Not Allowed: the HTTP method isn’t supported for this endpoint
// 408 Request Timeout: the server timed out waiting for the request
// 409 Conflict: the request conflicts with the resource’s current state (eg duplicate entry)
// 413 Payload Too Large: the request body exceeds the size limit
// 422 Unprocessable Entity: the request is well-formed but fails validation
// 429 Too Many Requests: you’ve hit a rate limit