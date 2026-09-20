import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginSignup from './pages/LoginSignUp'
import Home from './pages/Home'
import Movie from './pages/Movie'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSignup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/movies/:id" element={<Movie />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App