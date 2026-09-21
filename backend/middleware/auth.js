import jwt from 'jsonwebtoken'

export function verifyToken(req) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const accessToken = authHeader.split(' ')[1]

  try {
    return jwt.verify(accessToken, process.env.ACCESS_SECRET_KEY)
  } catch {
    return null
  }
}
