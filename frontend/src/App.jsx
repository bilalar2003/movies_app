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