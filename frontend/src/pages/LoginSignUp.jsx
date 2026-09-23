import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function LoginSignup() {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (event) => { // this function runs when input field changes in signup form
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  } // handles changes to the form inputs, updating the corresponding field in the form state

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSuccessMessage('')
    setErrorMessage('')

    if (isLogin) {
      try {
        const res = await fetch('http://localhost:4000/api/login', {
          method: 'POST',
          credentials: 'include', // this tells browser to send and save credentials such as HTTP-only cookies (including refreshToken cookie) in cross origin requests
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.message || 'Login failed')
        }

        if (!data.accessToken) {
          throw new Error('Login response did not return a token.')
        }

        localStorage.setItem('accessToken', data.accessToken) // accessToken set in localStorage
        localStorage.setItem('currentUser', JSON.stringify(data.user))
        // No need to do it for refreshToken, as it's stored automatically by browser as HTTP-only cookie
        // you can't see HTTP-Only cookie in inspect mode on browser as well. 
        setSuccessMessage(data.message)
        setForm(initialForm)
        navigate(data.user.role === 'admin' ? '/admin-home' : '/home')
      } catch (error) {
        setErrorMessage(error.message)
      }
      return
    }

    if (form.password !== form.confirmPassword) {
      setErrorMessage('Passwords do not match')
      return
    }

    if (form.password.length < 5 || !/[^A-Za-z0-9\s]/.test(form.password)) {
      setErrorMessage('Password must be at least 5 characters long and include at least one special character.')
      return
    }

    try {
      const res = await fetch('http://localhost:4000/api/signup', { // we receive JSON response from backend server, according to outcome 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      })

      const data = await res.json() // the response is parsed (converted back) to live JS object

      if (!res.ok) { // this sees if statusCode is not in range 200-299, meaning the request failed
        throw new Error(data.message || 'Signup failed')
      }

      setSuccessMessage(data.message) 
      setForm(initialForm)
      setIsLogin(true)
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  return (
    <main className="auth-shell">
      <div className="card auth-card shadow-2xl border border-slate-700/70">
        <div className="card-body">
          <div className="flex justify-center mb-2">
            <div className="auth-badge">M</div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white">Movies Inn</h1>
            <p className="text-sm text-slate-300 mt-2">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </p>
          </div>

          <div className="tabs tabs-boxed mb-6">
            <button
              type="button"
              className={`tab flex-1 ${isLogin ? 'tab-active' : ''}`}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button
              type="button"
              className={`tab flex-1 ${!isLogin ? 'tab-active' : ''}`}
              onClick={() => setIsLogin(false)}
            >
              Sign up
            </button>
          </div>

          {successMessage && (
            <div className="alert alert-success mb-4">{successMessage}</div>
          )}

          {errorMessage && (
            <div className="alert alert-error mb-4">{errorMessage}</div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-form-stack">
              {!isLogin && (
                <label className="form-control">
                  <span className="label">
                    <span className="label-text">Full name</span>
                  </span>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="input input-bordered w-full"
                    required
                  />
                </label>
              )}

              <label className="form-control">
                <span className="label">
                  <span className="label-text">Email address</span>
                </span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="input input-bordered w-full"
                  required
                />
              </label>

              <label className="form-control">
                <span className="label">
                  <span className="label-text">Password</span>
                </span>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="input input-bordered w-full"
                  required
                />
              </label>

              {!isLogin && (
                <label className="form-control">
                  <span className="label">
                    <span className="label-text">Confirm password</span>
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                    className="input input-bordered w-full"
                    required
                  />
                </label>
              )}

              <button type="submit" className="btn btn-primary w-full mt-2">
                {isLogin ? 'Login' : 'Create account'}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-slate-300 mt-5 mb-0">
            {isLogin ? 'Need an account?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="link link-primary font-semibold"
              onClick={() => setIsLogin((prev) => !prev)}
            >
              {isLogin ? 'Sign up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}

export default LoginSignup