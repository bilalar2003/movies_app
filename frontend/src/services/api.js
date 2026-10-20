const API_URL = 'http://localhost:4000'
const apiPrefix = '/api/'

export async function refreshAccessToken() { // this function just calls the api/refresh API on server 
  const response = await fetch(`${API_URL}${apiPrefix}refresh`, { // to get new accessToken
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
  await fetch(`${API_URL}${apiPrefix}logout`, { // API call made to server.js for logging out.
    method: 'POST',
    credentials: 'include',
  })

  localStorage.removeItem('accessToken') // accessToken removed from browser storage.
  localStorage.removeItem('currentUser') // currentUser as well. 
}

export async function fetchProfile() {
  const response = await fetchProtected(`${apiPrefix}profile`) // api call to fetch user profile 
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Failed to load profile')
  }
 
  return data
}

// below is function to set/unset movie as fave on click on home page 
export async function updateFavorite(movieId, isFavorite) {
    const response = await fetchProtected(`${apiPrefix}favorites/${movieId}`, {
      method: isFavorite ? 'PUT' : 'DELETE', // if true, means to fave the movie, else unfave it 
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update favorite')
    }

    return data.isFavorite
}

// The future API requests reach this below function first.
// Then this function hits the requested endpoint in our server.js
export async function fetchProtected(url, options = {}) { 
  // in above, the param url holds value: '/api/etc'
  let accessToken = localStorage.getItem('accessToken') // get accessToken from browser storage.
  const request = (token) => fetch(`${API_URL}${url}`, { // API call to server.js on mentioned endpoint.
    ...options, // Includes additional request options, eg {method: 'PUT'} or body in frontend fetch() call.
    credentials: 'include', // this allows browser to send cookies with request objects.
    headers: {
      ...options.headers, // send any additional headers in request object.
      Authorization: `Bearer ${token}`, // send auth header with accessToken in it. 
    }, 
  })
  // NOTE: Fetch() defaults to GET method when method isn't specified in fetch() API call
  // on frontend. 

  let response = await request(accessToken) // gets response object from request() method above, 
  // that actually calls the endpoint in server.js.

  if (response.status === 401) { // if accessToken expired, get new accessToken.
    accessToken = await refreshAccessToken() // accessToken is retrieved using refreshToken. 
    response = await request(accessToken) // then call the server endpoint again. 
  }

  return response // return response sent from server to frontend page. 
}