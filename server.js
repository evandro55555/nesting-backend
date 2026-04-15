const express = require("express");
const app = express();

// Permitir receber JSON
app.use(express.json());

// Rota de teste
app.get("/", (req, res) => {
  res.send("Servidor rodando 🚀");
});

// Rota de nesting (simples em grade)
app.post("/nesting", (req, res) => {
  try {
    const { parts } = req.body;

    if (!parts || !Array.isArray(parts)) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    let x = 0;
    let y = 0;

    const spacing = 100; // espaço entre peças
    const maxWidth = 500; // largura da chapa

    const placements = [];

    parts.forEach((part) => {
      for (let i = 0; i < part.quantity; i++) {
        placements.push({
          partId: part.id,
          x: x,
          y: y,
          rotation: 0
        });

        x += spacing;

        if (x > maxWidth) {
          x = 0;
          y += spacing;
        }
      }
    });

    console.log("[NESTING] Resultado:", placements);

    res.json({ placements });

  } catch (error) {
    console.error("Erro no nesting:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// Porta (Render usa process.env.PORT)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});