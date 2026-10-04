import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Welcome from './pages/Welcome.jsx'
import Calendar from './pages/Calendar.jsx'
import Day from './pages/Day.jsx'
import ChallengesIntro from './pages/challenges/ChallengesIntro.jsx'
import ChallengesList from './pages/challenges/ChallengesList.jsx'
import Challenge from './pages/challenges/Challenge.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/calendario" element={<Calendar />} />
        <Route path="/dia/:id" element={<Day />} />
        {/* Juego de pruebas */}
        <Route path="/pruebas" element={<ChallengesIntro />} />
        <Route path="/pruebas/lista" element={<ChallengesList />} />
        <Route path="/pruebas/prueba/:id" element={<Challenge />} />
      </Routes>
    </BrowserRouter>
  )
}
