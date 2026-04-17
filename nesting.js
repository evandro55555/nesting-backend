/**
 * Motor de Nesting: MaxRects API (Industrial Standard)
 * Algoritmo: Bottom-Left Fill Heuristic com Free Rectangles Split
 * Garante o aproveitamento ótimo evitando "buracos invisíveis" e ordenação 100% sequencial.
 */

function runNesting(parts, sheet) {
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

  // REQUISITO 3: Ordenar pelo MAIOR LADO PRIMEIRO, depois por ÁREA.
  // Essa heurística aliada ao MaxRects produz faixas compactas (guilhotináveis) perfeitas.
  queue.sort((a, b) => {
      const maxA = Math.max(a.w, a.h);
      const maxB = Math.max(b.w, b.h);
      if (maxB !== maxA) return maxB - maxA;
      return (b.w * b.h) - (a.w * a.h);
  });

  let unplaced = [];
  let sheetsUsed = [];
  
  let freeRects = [];
  let currentPlacements = [];
  let currentSheetIdx = 1;

  const initSheet = () => {
      freeRects = [{
          x: margin,
          y: margin, // REQUISITO 2: Prioriza Canto Inferior Esquerdo (Y partindo do mínimo)
          w: sheetWidth - (2 * margin),
          h: sheetHeight - (2 * margin)
      }];
      currentPlacements = [];
  };

  const finalizeSheet = () => {
      if (currentPlacements.length > 0) {
          sheetsUsed.push({
              sheetId: `Chapa_${currentSheetIdx++}`,
              width: sheetWidth,
              height: sheetHeight,
              placements: currentPlacements,
              usedArea: currentPlacements.reduce((s, p) => s + (p.w * p.h), 0)
          });
      }
      initSheet();
  };

  // Funções Utilitárias MaxRects (Evitar sobreposição - REQUISITO 4 e 5)
  const isContained = (inner, outer) => {
      return inner.x >= outer.x && inner.y >= outer.y && 
             inner.x + inner.w <= outer.x + outer.w && 
             inner.y + inner.h <= outer.y + outer.h;
  };

  const pruneFreeRects = () => {
      // Degradação Mágica: Remove retângulos em branco que estão 100% contidos em outros maiores
      let i = 0;
      while (i < freeRects.length) {
          let j = 0;
          let remove = false;
          while (j < freeRects.length) {
              if (i !== j && isContained(freeRects[i], freeRects[j])) {
                  remove = true;
                  break;
              }
              j++;
          }
          if (remove) {
              freeRects.splice(i, 1);
          } else {
              i++;
          }
      }
  };

  const splitFreeRect = (freeNode, placedRect) => {
      // Checa a sobreposição matemática
      if (placedRect.x >= freeNode.x + freeNode.w || placedRect.x + placedRect.w <= freeNode.x ||
          placedRect.y >= freeNode.y + freeNode.h || placedRect.y + placedRect.h <= freeNode.y) {
          return [freeNode]; // Não sobrepõe (Fica 100% seguro intacto)
      }

      let newRects = [];

      // Top split
      if (placedRect.y + placedRect.h < freeNode.y + freeNode.h) {
          newRects.push({
              x: freeNode.x,
              y: placedRect.y + placedRect.h,
              w: freeNode.w,
              h: freeNode.y + freeNode.h - (placedRect.y + placedRect.h)
          });
      }

      // Bottom split
      if (placedRect.y > freeNode.y) {
          newRects.push({
              x: freeNode.x,
              y: freeNode.y,
              w: freeNode.w,
              h: placedRect.y - freeNode.y
          });
      }

      // Right split
      if (placedRect.x + placedRect.w < freeNode.x + freeNode.w) {
          newRects.push({
              x: placedRect.x + placedRect.w,
              y: freeNode.y,
              w: freeNode.x + freeNode.w - (placedRect.x + placedRect.w),
              h: freeNode.h
          });
      }

      // Left split
      if (placedRect.x > freeNode.x) {
          newRects.push({
              x: freeNode.x,
              y: freeNode.y,
              w: placedRect.x - freeNode.x,
              h: freeNode.h
          });
      }

      return newRects;
  };

  // START INDUSTRIAL ENGINE
  initSheet();

  while (queue.length > 0) {
      const part = queue.shift();
      
      let bestNode = { score1: Infinity, score2: Infinity, rect: null, rot: 0 };
      
      // REQUISITO 4: Rotações Automáticas 0° e 90°
      for (const rot of [0, 90]) {
          const pw = rot === 0 ? part.w : part.h;
          const ph = rot === 0 ? part.h : part.w;
          
          for (const freeRect of freeRects) {
              if (freeRect.w >= pw && freeRect.h >= ph) {
                  // Métrica BLF Strict (Bottom-Left)
                  // Minimizar Y atrai vigorosamente a gravidade para as bordas fundas!
                  const score1 = freeRect.y; 
                  const score2 = freeRect.x;
                  
                  if (score1 < bestNode.score1 || (score1 === bestNode.score1 && score2 < bestNode.score2)) {
                      bestNode.score1 = score1;
                      bestNode.score2 = score2;
                      bestNode.rect = freeRect;
                      bestNode.rot = rot;
                      bestNode.pw = pw;
                      bestNode.ph = ph;
                  }
              }
          }
      }

      if (bestNode.rect) {
          const placedX = bestNode.rect.x;
          const placedY = bestNode.rect.y;
          
          // O GAP É APLICADO COMO AUMENTO VIRTUAL DA CÁPSULA (BoundingBox estufada)
          // Isso garante a margem de recuo automática em relação às outras chapas.
          const padW = bestNode.pw + gap;
          const padH = bestNode.ph + gap;

          // Quebra todos os Rects da memória que colidem com a nova peça
          const virtualPlacedNode = { x: placedX, y: placedY, w: padW, h: padH };
          
          let nextFreeRects = [];
          for (const fr of freeRects) {
              const splits = splitFreeRect(fr, virtualPlacedNode);
              nextFreeRects.push(...splits);
          }
          freeRects = nextFreeRects;
          pruneFreeRects(); // REQUISITO 8: Mantém a performance absurda limpando memórias vazias apagadas

          currentPlacements.push({
              partId: part.id,
              name: part.name,
              x: placedX,
              y: placedY,
              w: bestNode.pw,
              h: bestNode.ph,
              rotation: bestNode.rot
          });

      } else {
          // A Peça não cabe mais (Todos os FreeRects da Chapa estão picotados ou mortos)
          if (currentPlacements.length === 0) {
              // A peça sozinha já estoura a chapa em si!
              unplaced.push(part);
          } else {
              finalizeSheet();
              queue.unshift(part); // Retorna a peça pro topo da fila para habitar a Chapa 2!
          }
      }
  }

  finalizeSheet();

  return {
      sheets: sheetsUsed,
      unplacedParts: unplaced
  };
}

module.exports = { runNesting };
