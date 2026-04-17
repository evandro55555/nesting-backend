const express = require('express');
const cors = require('cors');
const { runNesting } = require('./nesting');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API NESTING ONLINE');
});

app.post('/nesting', async (req, res) => {
  try {
    const { parts, sheet } = req.body;

    const result = runNesting(parts, sheet);

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no nesting' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor rodando na porta', PORT));
