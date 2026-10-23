import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LoginSignup from './pages/LoginSignUp'
import Home from './pages/Home'
import AdminHome from './pages/AdminHome'
import AdminMovie from './pages/AdminMovie'
import Movie from './pages/Movie'
import UserProfile from './pages/UserProfile'

function App() {
  return (
    <BrowserRouter> {/*this is react router dom, for routing between our pages.*/}
      <Routes>
        <Route path="/" element={<LoginSignup />} /> {/*Show homepage on /*/}
        <Route path="/home" element={<Home />} /> {/*Show home page on /home*/}
        <Route path="/admin-home" element={<AdminHome />} /> {/*Show admin home page on /admin-home*/}
        <Route path="/adminMovie/:id" element={<AdminMovie />} />
        <Route path="/movies/:id" element={<Movie />} /> {/*Show movie page on /movies/:id*/}
        <Route path="/profile" element={<UserProfile />} /> {/*Show user profile page on /profile*/}
      </Routes>
    </BrowserRouter>
  )
}

export default App

// NOTE: How a component re-renders exactly 

// You click the button, and the handler runs using the old values of both states.
// setText('red') saves the new value in a waiting list and tells React “re-render later”.
// setAlertMsg('red') saves its new value in its own waiting list. React already knows a re-render is coming, so it doesn’t add another.
// The handler ends, so React now re-renders the component once.
// During that render, React reads the waiting lists and gives you the new values (text = 'red', alertMsg = 'red').
// React updates the screen one time with both changes.