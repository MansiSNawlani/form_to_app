import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'

/* Placeholder page. Step 4 replaces this with the real AppShell.
   The two controls exist to prove the MUI theme mapping, per step 3. */
function App() {
  return (
    <div style={{ padding: '2rem', display: 'grid', gap: '1rem', maxWidth: '24rem' }}>
      <h1>Protokoll E-Befischung</h1>
      <TextField label="Gewässer" defaultValue="Schussen" />
      <Button variant="contained">Speichern</Button>
      <Button variant="outlined">Abbrechen</Button>
    </div>
  )
}

export default App
