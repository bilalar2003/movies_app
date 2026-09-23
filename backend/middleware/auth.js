import jwt from 'jsonwebtoken'

export function verifyToken(req) {
  const authHeader = req.headers.authorization // Extract authorzation header from request object

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null // return null if header is empty
  }

  const accessToken = authHeader.split(' ')[1] // extract accessToken from authorization header

  try {
    return jwt.verify(accessToken, process.env.ACCESS_SECRET_KEY) // returns decoded object: 
    // {userId, normalizedEmail, role, iat, exp}. iat and exp are automatically added by JWT.
    // Note that userId, normalizedEmail, and role were payload fields explicitly signed 
    // at the time of user logging in. 
  } catch { 
    return null // return null if error
  }
}
