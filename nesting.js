/**
 * Motor de Nesting AABB + Heurística BLF (Bottom-Left Fill) com Gravidade.
 * Escrito puramente em JS para rodar isolado num servidor Node.js
 */

function runNesting(parts, sheetConfig) {
  // 1. Expand properties to quantities and flatten
  let queue = [];
  parts.forEach(p => {
    for (let i = 0; i < p.quantity; i++) {
        queue.push({
            id: p.id,
            name: p.name,
            w: p.width,
            h: p.height
        });
    }
  });

  // 2. Sort parts by descending area (maior primeiro - requisito 8)
  queue.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  const sheetWidth = sheetConfig.width;
  const sheetHeight = sheetConfig.height;
  const margin = sheetConfig.margin || 5;
  const gap = sheetConfig.kerfGap || 2;
  const step = 15; // Passos de varredura (Sweep Resolution - requisito 2)

  let sheetsUsed = [];
  let currentPlacements = [];
  let unplaced = [];

  // Requisito 9 e 10: Pre-teste rápido de BBox e Colisão exata (AABB)
  const aabbOverlap = (x1, y1, w1, h1, x2, y2, w2, h2) => {
      return !(
          x1 + w1 + gap <= x2 ||
          x2 + w2 + gap <= x1 ||
          y1 + h1 + gap <= y2 ||
          y2 + h2 + gap <= y1
      );
  };

  const checkCollision = (testX, testY, pw, ph, placements) => {
      // Limites da chapa
      if (testX < margin || testX + pw > sheetWidth - margin) return true;
      if (testY < margin || testY + ph > sheetHeight - margin) return true;
      
      // Colisão com peças já postas
      for (const pl of placements) {
          if (aabbOverlap(testX, testY, pw, ph, pl.x, pl.y, pl.w, pl.h)) return true;
      }
      return false;
  };

  let currentSheetIdx = 1;
  const finalizeSheet = () => {
      sheetsUsed.push({
          sheetId: `Chapa_${currentSheetIdx++}`,
          width: sheetWidth,
          height: sheetHeight,
          placements: currentPlacements,
          usedArea: currentPlacements.reduce((s, p) => s + (p.w * p.h), 0)
      });
      currentPlacements = [];
  };

  // Loop de processamento
  while(queue.length > 0) {
      const part = queue.shift();
      let bestScore = Infinity;
      let bestPlacement = null;

      // 4. Test both rotations (Requisito 5)
      const rotations = [0, 90];
      
      for (const rot of rotations) {
          const pw = rot === 0 ? part.w : part.h;
          const ph = rot === 0 ? part.h : part.w;

          if (pw > sheetWidth - 2*margin || ph > sheetHeight - 2*margin) {
              continue; // Não cabe de jeito nenhum
          }

          // 5. Sweep Grid - Varrer toda a área (Requisitos 1 e 2)
          for (let y = margin; y <= sheetHeight - ph - margin; y += step) {
              for (let x = margin; x <= sheetWidth - pw - margin; x += step) {
                  if (!checkCollision(x, y, pw, ph, currentPlacements)) {
                      // 6. Sistema de Score (Requisito 3)
                      let touchScore = 0;
                      // Bônus se encostar nas paredes (Compactação Lateral - Requisito 4)
                      if (x <= margin + gap) touchScore += 50;
                      if (y <= margin + gap) touchScore += 50;
                      
                      // Bônus para proximidade de outras peças
                      for (const pl of currentPlacements) {
                          const dist = Math.hypot(pl.x - x, pl.y - y);
                          if (dist < Math.max(pw, ph) + Math.max(pl.w, pl.h)) {
                              touchScore += 20; 
                          }
                      }

                      // Score = Y*peso + X*peso - Bônus (Buscamos o menor score)
                      const score = (y * 1000) + (x * 10) - touchScore;
                      
                      if (score < bestScore) {
                          bestScore = score;
                          bestPlacement = { partId: part.id, w: pw, h: ph, x, y, rotation: rot };
                      }
                  }
              }
          }
      }

      // 7. Aplicar Gravidade após achar a melhor posição do Grid (Requisito 6)
      if (bestPlacement) {
          let finalX = bestPlacement.x;
          let finalY = bestPlacement.y;
          
          while (finalY > margin && !checkCollision(finalX, finalY - 1, bestPlacement.w, bestPlacement.h, currentPlacements)) {
              finalY--;
          }
          while (finalX > margin && !checkCollision(finalX - 1, finalY, bestPlacement.w, bestPlacement.h, currentPlacements)) {
              finalX--;
          }
          
          bestPlacement.x = finalX;
          bestPlacement.y = finalY;
          currentPlacements.push(bestPlacement);
      } else {
          // Quando falha, passa pra próxima chapa
          if (currentPlacements.length === 0) {
              unplaced.push(part);
          } else {
              finalizeSheet();
              queue.unshift(part); // Devolve a peça pra fila para tentar na nova chapa
          }
      }
  }

  // Verifica restos da ultima chapa
  if (currentPlacements.length > 0) {
      finalizeSheet();
  }

  return {
      sheets: sheetsUsed,
      unplacedParts: unplaced
  };
}

module.exports = { runNesting };
