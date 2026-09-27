import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Welcome from './pages/Welcome.jsx'
import Calendar from './pages/Calendar.jsx'
import Day from './pages/Day.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/calendario" element={<Calendar />} />
        <Route path="/dia/:id" element={<Day />} />
      </Routes>
    </BrowserRouter>
  )
}
