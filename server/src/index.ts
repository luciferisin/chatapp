import express from 'express';
import cors from 'cors';
import { getTurnCredentials } from './services/xirsys';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/turn-credentials', async (req, res) => {
  try {
    const credentials = await getTurnCredentials();
    res.json(credentials);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get TURN credentials' });
  }
});

app.listen(3001, () => {
  console.log('Signaling server running on port 3001');
}); 