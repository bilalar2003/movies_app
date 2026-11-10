import { EventEmitter } from 'node:events'

export async function invokeRoute(handler, {
  method = 'GET',
  path,
  token,
  body,
} = {}) {
  const req = new EventEmitter()
  req.method = method
  req.headers = token
    ? { authorization: `Bearer ${token}` }
    : {}

  let resolveResponse
  const responseFinished = new Promise((resolve) => {
    resolveResponse = resolve
  })

  const res = {
    statusCode: undefined,
    headers: {},
    body: undefined,
    ended: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode
      Object.assign(this.headers, headers)
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(payload = '') {
      this.ended = true
      this.body = payload ? JSON.parse(payload) : undefined
      resolveResponse()
    },
  }

  const handled = await handler(req, res, new URL(path, 'http://localhost'))

  if (!handled) {
    return { handled, res }
  }

  if (!res.ended) {
    if (body !== undefined) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body)
      req.emit('data', Buffer.from(payload))
    }
    req.emit('end')
  }

  if (!res.ended) {
    await responseFinished
  }

  return { handled, res }
}
