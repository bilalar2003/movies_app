const API_URL = 'http://localhost:4000'

export async function refreshAccessToken() { // this function just calls the api/refresh API on server 
  const response = await fetch(`${API_URL}/api/refresh`, { // to get new accessToken
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) { // if refreshToken is invalid, the accessToken is removed. 
    localStorage.removeItem('accessToken')
    throw new Error('Session expired') // This line then stops the request flow and sends error directly to catch block of frontend home.jsx.
  } // the error message is displayed by home.jsx. 

  const data = await response.json()
  localStorage.setItem('accessToken', data.accessToken) // update accessToken in browser storage.
  return data.accessToken // return new accessToken.
}

export async function logout() {
  await fetch(`${API_URL}/api/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  localStorage.removeItem('accessToken')
  localStorage.removeItem('currentUser')
}

export async function fetchProfile() {
  const response = await fetchProtected('/api/profile')
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Failed to load profile')
  }

  localStorage.setItem('currentUser', JSON.stringify(data.user))
  return data.user
}


// The future API requests then reach this below function first.
// Then this function hits the intended endpoint in our server.js
export async function fetchProtected(url, options = {}) { // fetchProtected() calls the server endpoint, also sends request object from its end
  let accessToken = localStorage.getItem('accessToken')
  const request = (token) => fetch(`${API_URL}${url}`, { // this sends a fetch call to the given protected URL (in server.js)
  // forwarding any cookies (`credentials: 'include'`) 
  // and attaching the passed-in `token` as a `Bearer` token in the `Authorization` header.
    ...options, // attach the body and method value in this request 
    credentials: 'include', // this sends the cookie with refreshToken in this request object.
    headers: { // attach headers from the original request object 
      ...options.headers, // sending the headers too
      Authorization: `Bearer ${token}`, // and authorisation header with the accessToken. 
    }, // all this above is the request object being sent to target endpoint in server.js
  })

  let response = await request(accessToken) // gets response object from request() method above, that actually calls the endpoint in server.js.

  if (response.status === 401) { // if accessToken expired, get new accessToken.
    accessToken = await refreshAccessToken()
    response = await request(accessToken) // then call the server endpoint again. 
  }

  return response
}