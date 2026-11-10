import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { handleAdminRoutes } from '../routes/adminRoutes.js'
import { handleSharedRoutes } from '../routes/sharedRoutes.js'
import { handleUserRoutes } from '../routes/userRoutes.js'
import { invokeRoute } from '../test-support/http.js'

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

function accessToken(role = 'user', userId = 7) {
  return jwt.sign({ userId, role }, testSecret, { expiresIn: '1h' })
}

test('protects the shared movie list from unauthenticated requests', async (t) => {
  const query = t.mock.method(pool, 'query')
  const { handled, res } = await invokeRoute(handleSharedRoutes, {
    path: '/api/movies',
  })

  assert.equal(handled, true)
  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.body, { message: 'Authentication required.' })
  assert.equal(query.mock.callCount(), 0)
})

test('returns the requested movie page with a clamped page number', async (t) => {
  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('COUNT(*)')) {
      return { rows: [{ total: 27 }] }
    }
    return { rows: [{ id: 21, title: 'Example', is_favorite: false }] }
  })

  const { res } = await invokeRoute(handleSharedRoutes, {
    path: '/api/movies?page=99',
    token: accessToken(),
  })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, {
    movies: [{ id: 21, title: 'Example', is_favorite: false }],
    page: 3,
    limit: 10,
    offset: 20,
    totalMovies: 27,
    totalPages: 3,
  })
})

test('returns movie details and its reviews', async (t) => {
  const queries = [
    { rows: [{ id: 12, title: 'Example' }] },
    { rows: [{ review_id: 3, user_rating: 5, review: 'Great', user_name: 'Sam' }] },
  ]
  t.mock.method(pool, 'query', async () => queries.shift())

  const { res } = await invokeRoute(handleSharedRoutes, {
    path: '/api/movies/12',
    token: accessToken(),
  })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, {
    movie: { id: 12, title: 'Example' },
    reviews: [{ review_id: 3, user_rating: 5, review: 'Great', user_name: 'Sam' }],
  })
})

test('rejects favorite changes by admins', async (t) => {
  const query = t.mock.method(pool, 'query')
  const { res } = await invokeRoute(handleUserRoutes, {
    method: 'PUT',
    path: '/api/favorites/12',
    token: accessToken('admin'),
  })

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.body, { message: 'Only users can manage favorites.' })
  assert.equal(query.mock.callCount(), 0)
})

test('adds a favorite for an authenticated user', async (t) => {
  const query = t.mock.method(pool, 'query', async () => ({ rows: [] }))
  const { res } = await invokeRoute(handleUserRoutes, {
    method: 'PUT',
    path: '/api/favorites/12',
    token: accessToken(),
  })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { isFavorite: true })
  assert.deepEqual(query.mock.calls[0].arguments[1], [7, 12])
})

test('validates review submissions before querying the database', async (t) => {
  const query = t.mock.method(pool, 'query')
  const { res } = await invokeRoute(handleUserRoutes, {
    method: 'POST',
    path: '/api/movies/12/reviews',
    token: accessToken(),
    body: { rating: 6, review: 'Not a valid rating' },
  })

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, {
    message: 'A rating from 1 to 5 and a review are required.',
  })
  assert.equal(query.mock.callCount(), 0)
})

test('rejects unauthenticated admin requests without querying the database', async (t) => {
  const query = t.mock.method(pool, 'query')
  const { res } = await invokeRoute(handleAdminRoutes, {
    path: '/api/admin/users',
  })

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.body, { message: 'Authentication required.' })
  assert.equal(query.mock.callCount(), 0)
})

test('validates movie creation input for an admin', async (t) => {
  const query = t.mock.method(pool, 'query')
  const { res } = await invokeRoute(handleAdminRoutes, {
    method: 'POST',
    path: '/api/admin/movies',
    token: accessToken('admin'),
    body: {
      title: 'Example',
      description: 'Description',
      genre: 'Drama',
      release_year: 2020,
      rating: '10.5',
    },
  })

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, {
    message: 'Rating must be between 0 and 10.',
  })
  assert.equal(query.mock.callCount(), 0)
})

test('creates a movie for an admin with validated values', async (t) => {
  const movie = {
    id: 22,
    title: 'Example',
    description: 'Description',
    genre: 'Drama',
    rating: '8.5',
    release_year: 2020,
  }
  const query = t.mock.method(pool, 'query', async () => ({ rows: [movie] }))
  const { res } = await invokeRoute(handleAdminRoutes, {
    method: 'POST',
    path: '/api/admin/movies',
    token: accessToken('admin'),
    body: {
      title: ' Example ',
      description: ' Description ',
      genre: ' Drama ',
      release_year: 2020,
      rating: '8.5',
    },
  })

  assert.equal(res.statusCode, 201)
  assert.deepEqual(res.body, {
    message: 'Movie created successfully.',
    movie,
  })
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'Example',
    'Description',
    'Drama',
    8.5,
    2020,
  ])
})
