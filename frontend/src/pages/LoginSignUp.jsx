import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'

const initialForm = { // Initial fields object used by login & signup forms.
  name: '',
  email: '', 
}

function LoginSignup() {
  const navigate = useNavigate() // used for routing between pages.
  const [isLogin, setIsLogin] = useState(true) // state variable to toggle b/w login and signup forms.
  const [form, setForm] = useState(initialForm) // state variable to hold form input values, initialized with initialForm object.
  const [successMessage, setSuccessMessage] = useState('') // state variable to hold success msg. after login/signup.
  const [errorMessage, setErrorMessage] = useState('') // state to hold error msg. after login/signup.
  const ApiUrl = 'http://localhost:4000/api'

  // this is an event handler function.
  const handleChange = (event) => { // the event parameter is an object 
  // that contains info. about the event that occurred.
  // it is automatically passed to event handler when an event occurs (eg user typing in input field).
    // event.target is the html element that triggered the event.
    const name = event.target.name // name attribute of input field.
    const value = (name === 'password' || name === 'confirmPassword')
      ? event.target.value.replace(/ /g, '') // / /g is regex pattern to check for a space character, 
      // which is replaced by '' empty character. This prevents adding space in password field.  
      : event.target.value // value of the input field.
    // setForm updates form state and triggers re-render of component.
    setForm((prev) => ({ ...prev, [name]: value })) 
    // ...prev copies all properties of prev object into new object.
    // [name]: this sets the field that was changed by user;
    // found using name attribute of input field
    // and given the new value that user typed in.
  }

  const handleSubmit = async (event) => { // async allows function to use await to pause execution,
    // until a promise is reolved/rejected, (such as fetch() request to backend server),
    // and then resume execution with resolved value.
    
    event.preventDefault() // prevents page from reloading. 
    // It is normal browser behavior to reload page when a form is submitted.

    if (isLogin) { // upon submission, if isLogin was true, then login attempt was made. 
      try { // Login endpoint will be hit here. 
        const res = await fetch(`${ApiUrl}/login`, { // call login API in server.js
          method: 'POST', // tells server it's a POST request, meaning we're sending data to server.
          credentials: 'include', // this is needed to send cookies (refreshToken) from server to client,
          // and vice versa. 
          // It basically tells browser to include cookies in req. and accept cookies in response.
          headers: { // headers provide metadata about the request object.
            'Content-Type': 'application/json', // Tells server that the request body contains JSON data.
          },
          body: JSON.stringify({ // body is the data sent to server, converted to JSON string format,
            // for it to be transmitted.
            email: form.email, // setting email and password fields from form state variable. 
            password: form.password,
          }),
        })

        const data = await res.json() // this is where we recieve response object from server,
        // we first parse it to JSON format, and then store it in data variable.

        if (!res.ok) { // if res.ok is false, meaning statusCode is not in range 200-299,
          // it means request failed, and we throw an error with message from server response.
          throw new Error(data.message || 'Login failed')
        }

        if (!data.accessToken) { // if response does not contain accessToken, throw an error.
          throw new Error('Login response did not return a token.') 
        }
        // NOTE: Both these throw new Error blocks trigger the catch() block.
        // with sending the error object to the block.

        // here, login is verified, so proceed. 
        localStorage.setItem('accessToken', data.accessToken) // set accessToken in localStorage.
        localStorage.setItem('currentUser', JSON.stringify(data.user)) // set currentUser in localStorage, 
        // after converting it to JSON string format.
        // No need to store refreshToken, as it's stored automatically by browser as HTTP-only cookie.
        // you can't see HTTP-Only cookie in inspect mode on browser as well. 
        setSuccessMessage(data.message) // set server response msg into successMessage state variable.
        setForm(initialForm) // reset form, clearing all input fields.
        navigate(data.user.role === 'admin' ? '/admin-home' : '/home') 
        // navigate to admin home page if admin role, else user home page.
        // Note: calling a state setter doesn’t re-render immediately, it only queues an update, 
        // so your function keeps running through the second and third setters to the end, 
        // and then React (18+) batches all three into a single re-render.
      } catch (error) { // this block runs when an error is thrown by the try block. 
        setErrorMessage(error.message) // set error msg from server into error msg state variable. 
      }
      return
    }

    // if isLogin is false, then signup attempt was made. 
    // so we proceed to process the signup form submission.
    if (form.password !== form.confirmPassword) {
      setErrorMessage('Passwords do not match') // if password not matching, display error msg.
      return
    }

    if (form.password.length < 5 || !/[^A-Za-z0-9\s]/.test(form.password)) {
      // Above, the regex[] checks if password contains atleast one special character.
      //.test() checks if the regex pattern is found in the password string.
      setErrorMessage('Password must be at least 5 characters long and include at least one special character.')
      return
    }

    try {
      const res = await fetch(`${ApiUrl}/signup`, { // we receive JSON response from backend server, 
      // according to the outcome. 
      // Below is all same as before. 
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

      const data = await res.json() // the response is parsed (converted back) to live JS object.

      if (!res.ok) { // this sees if statusCode is not in range 200-299, meaning the request failed.
        throw new Error(data.message || 'Signup failed') // display error msg of request failing.
      }

      setSuccessMessage(data.message) // display signup success msg on screen. 
      setForm(initialForm)
      setIsLogin(true)
    } catch (error) { 
      setErrorMessage(error.message) // display corresponding error msg on screen if signup fails.
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
              {isLogin ? 'Welcome back' : 'Create your account'} {/*Show login form if isLogin=true*/}
            </p>
          </div>

          <div className="tabs tabs-boxed mb-6">
            <button
              type="button"
              className={`tab flex-1 ${isLogin ? 'tab-active' : ''}`}
              onClick={() => setIsLogin(true)} // sets isLogin state to true when clicked, showing login form.
            >
              Login
            </button>
            <button
              type="button"
              className={`tab flex-1 ${!isLogin ? 'tab-active' : ''}`}
              onClick={() => setIsLogin(false)} // sets isLogin state to false when clicked, showing signup form.
            >
              Sign up
            </button>
          </div>

          {/*displays success message after successful login/signup.*/}
          {successMessage && ( 
            <div className="alert alert-success mb-4">{successMessage}</div>
          )} 

          {/*displays error message upon failed login/signup.*/}
          {errorMessage && (
            <div className="alert alert-error mb-4">{errorMessage}</div>
          )}
          {/*noValidate disables browser's default form validation , so you can do it yourself.*/}
          <form onSubmit={handleSubmit} noValidate>
            {/*display signup form fields if isLogin is false*/} 
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

              {/*Shows login button if isLogin is true, otherwise signup button is shown.*/}

              {/*THIS IS THE BUTTON THAT INVOKES  HANDLESUBMIT() FUNCTION*/}
              <button type="submit" className="btn btn-primary w-full mt-2">
                {isLogin ? 'Login' : 'Create account'} 
              </button>
            </div>
          </form>
              {/*Shows sign up link if isLogin is true, otherwise login link is shown.*/}
          <p className="text-center text-sm text-slate-300 mt-5 mb-0">
            {isLogin ? 'Need an account?' : 'Already have an account?'}{' '}
            {/*Below, the setIsLogin() simply updates isLogin state value to opposite.*/}
            <button
              type="button"
              className="link link-primary font-semibold"
              onClick={() => setIsLogin((prev) => !prev)}
            >
              {isLogin ? 'Sign up' : 'Login'}
            </button>
            {/*this button above toggles between the login and signup links*/}
          </p>
        </div>
      </div>
    </main>
  )
}

export default LoginSignup