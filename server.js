const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor rodando 🚀");
});

app.post("/nesting", (req, res) => {
  console.log("Recebi dados:", req.body);

  res.json({
    placements: [
      { partId: "1", x: 0, y: 0, rotation: 0 },
      { partId: "2", x: 200, y: 100, rotation: 0 }
    ]
  });
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});