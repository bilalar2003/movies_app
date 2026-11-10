import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import { verifyToken } from '../middleware/auth.js'

const testSecret = 'test-access-secret'
const originalSecret = process.env.ACCESS_SECRET_KEY

test.before(() => {
  process.env.ACCESS_SECRET_KEY = testSecret
})

test.after(() => {
  if (originalSecret === undefined) {
    delete process.env.ACCESS_SECRET_KEY
  } else {
    process.env.ACCESS_SECRET_KEY = originalSecret
  }
})

test('returns null when the authorization header is missing or malformed', () => {
  assert.equal(verifyToken({ headers: {} }), null)
  assert.equal(verifyToken({ headers: { authorization: 'Basic token' } }), null)
})

test('returns the decoded payload for a valid bearer token', () => {
  const token = jwt.sign(
    { userId: 7, role: 'user' },
    testSecret,
    { expiresIn: '1h' }
  )

  const decoded = verifyToken({ headers: { authorization: `Bearer ${token}` } })
  assert.equal(decoded.userId, 7)
  assert.equal(decoded.role, 'user')
  assert.equal(typeof decoded.iat, 'number')
  assert.equal(typeof decoded.exp, 'number')
})

test('returns null for invalid, expired, or wrongly signed tokens', () => {
  const expiredToken = jwt.sign({ userId: 7 }, testSecret, { expiresIn: -1 })
  const wrongSecretToken = jwt.sign({ userId: 7 }, 'different-test-secret')

  assert.equal(verifyToken({ headers: { authorization: 'Bearer invalid' } }), null)
  assert.equal(
    verifyToken({ headers: { authorization: `Bearer ${expiredToken}` } }),
    null
  )
  assert.equal(
    verifyToken({ headers: { authorization: `Bearer ${wrongSecretToken}` } }),
    null
  )
})
