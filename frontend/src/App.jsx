import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LoginSignup from './pages/LoginSignUp'
import Home from './pages/Home'
import Movie from './pages/Movie'
import UserProfile from './pages/UserProfile'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSignup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/movies/:id" element={<Movie />} />
        <Route path="/profile" element={<UserProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App