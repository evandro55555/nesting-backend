/**
 * Motor de Nesting AABB + Heurística Industrial Bottom-Left Fill (BLF)
 * Substitui o scan espacial 2D por pontos candidatos (MaxRects aproximado)
 * Eliminando travamentos severos e solucionando perdas de colisão.
 */

function runNesting(parts, sheet) {
  // 1. Converter tudo estritamente para Número (Garante que payloads JSON não crashem o grid)
  const sheetWidth = Number(sheet.width) || 3000;
  const sheetHeight = Number(sheet.height) || 1500;
  const margin = Number(sheet.margin) !== undefined && !isNaN(Number(sheet.margin)) ? Number(sheet.margin) : 5;
  const gap = Number(sheet.kerfGap) !== undefined && !isNaN(Number(sheet.kerfGap)) ? Number(sheet.kerfGap) : 5;

  let queue = [];
  
  if (Array.isArray(parts)) {
      parts.forEach(p => {
          const qty = Number(p.quantity) || 1;
          for (let i = 0; i < qty; i++) {
              queue.push({
                  id: p.id,
                  name: p.name || `P_${p.id}`,
                  w: Number(p.width),
                  h: Number(p.height)
              });
          }
      });
  }

  // 2. Ordenar Peças por Área Decrescente (Heurística FFD - First Fit Decreasing) - REQUISITO 8 e Extra
  queue.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  const aabbOverlap = (x1, y1, w1, h1, x2, y2, w2, h2) => {
      // Retorna VERDADEIRO se colidir
      return !(
          x1 + w1 + gap <= x2 ||
          x2 + w2 + gap <= x1 ||
          y1 + h1 + gap <= y2 ||
          y2 + h2 + gap <= y1
      );
  };

  const checkCollision = (testX, testY, pw, ph, placements) => {
      // Colisão com os Limites
      if (testX < margin || testX + pw > sheetWidth - margin) return true;
      if (testY < margin || testY + ph > sheetHeight - margin) return true;
      
      // Colisão com outras peças já posicionadas
      for (const pl of placements) {
          if (aabbOverlap(testX, testY, pw, ph, pl.x, pl.y, pl.w, pl.h)) return true;
      }
      return false;
  };

  let unplaced = [];
  let sheetsUsed = [];
  
  let currentPlacements = [];
  let currentSheetIdx = 1;

  const finalizeSheet = () => {
      if (currentPlacements.length > 0) {
          sheetsUsed.push({
              sheetId: `Chapa_${currentSheetIdx++}`,
              width: sheetWidth,
              height: sheetHeight,
              placements: currentPlacements,
              usedArea: currentPlacements.reduce((s, p) => s + (p.w * p.h), 0)
          });
          currentPlacements = [];
      }
  };

  // LOOP INDUSTRIAL BLF (PONTOS CANDIDATOS)
  while (queue.length > 0) {
      const part = queue.shift();
      
      let bestX = null;
      let bestY = null;
      let bestRot = null;
      let placed = false;
      
      // 3. Candidate Points: Quais pontos testar?
      // Sempre no Bottom-Left extremo, e nas margens de colisão superior e direita de peças instaladas
      const candidatePoints = [ { x: margin, y: margin } ];
      
      for (const pl of currentPlacements) {
         // Pontos a direita da peça existente
         candidatePoints.push({ x: pl.x + pl.w + gap, y: pl.y });
         candidatePoints.push({ x: pl.x + pl.w + gap, y: margin }); 
         
         // Pontos acima da peça existente
         candidatePoints.push({ x: pl.x, y: pl.y + pl.h + gap });
         candidatePoints.push({ x: margin, y: pl.y + pl.h + gap }); 
         
         // Quinas internas de escadas
         candidatePoints.push({ x: pl.x + pl.w + gap, y: pl.y + pl.h + gap });
      }

      // IMPORTANTE: Ordenar os pontos candidatos por MENOR Y, e desempate por MENOR X
      // Isso forma o preenchimento absoluto "Esquerda pra Direita, Baixo Pra Cima"
      candidatePoints.sort((a, b) => {
          if (Math.abs(a.y - b.y) > 0.01) return a.y - b.y;
          return a.x - b.x;
      });

      // 4. Testar o Primeiro Candidato Livre
      for (const pt of candidatePoints) {
          // Requisito: Rotação a 0º e 90º
          const rotations = [0, 90];
          for (const rot of rotations) {
              const pw = rot === 0 ? part.w : part.h;
              const ph = rot === 0 ? part.h : part.w;

              // Pré-restringir logo de cara peças gigantescas
              if (pw > sheetWidth - 2*margin || ph > sheetHeight - 2*margin) continue;

              if (!checkCollision(pt.x, pt.y, pw, ph, currentPlacements)) {
                  bestX = pt.x;
                  bestY = pt.y;
                  bestRot = rot;
                  placed = true;
                  break;
              }
          }
          if (placed) break;
      }

      if (placed) {
          // 5. Gravidade de Compressão Fina
          // Traz a precisão que o algoritmo Grid não tinha - escorre a peça ao limite do gap!
          let finalX = bestX;
          let finalY = bestY;
          const pw = bestRot === 0 ? part.w : part.h;
          const ph = bestRot === 0 ? part.h : part.w;

          let moved = true;
          while (moved) {
              moved = false;
              if (finalY > margin && !checkCollision(finalX, finalY - 1, pw, ph, currentPlacements)) {
                  finalY--;
                  moved = true;
              }
              if (finalX > margin && !checkCollision(finalX - 1, finalY, pw, ph, currentPlacements)) {
                  finalX--;
                  moved = true;
              }
          }

          currentPlacements.push({
              partId: part.id,
              name: part.name,
              x: finalX,
              y: finalY,
              w: pw,
              h: ph,
              rotation: bestRot
          });
      } else {
          // A Peça não cabe nesta chapa
          if (currentPlacements.length === 0) {
              // Se a tela estiver vazia e não caber, a peça é incompatível mesmo! Aborta ela.
              unplaced.push(part);
          } else {
              // Tela Cheia: Salva a Chapa atual como pronta e DEVOLVE a peça para ir à nova chapa
              finalizeSheet();
              queue.unshift(part); 
          }
      }
  }

  // Despeja a última chapa em produção
  finalizeSheet();

  return {
      sheets: sheetsUsed,
      unplacedParts: unplaced
  };
}

module.exports = { runNesting };
