import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Interview from './pages/Interview'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/interview" element={<Interview />} />
      <Route path="/interview/:id" element={<Interview />} />
    </Routes>
  )
}

export default App
