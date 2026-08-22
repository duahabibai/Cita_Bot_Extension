const fs = require('fs');

function updateScraper(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    const evalRegex = /\/\/ Known selectors for Extranjeria[\s\S]*?return foundBtns;\n      \}\);/g;
    
    const newEval = `// Check standard buttons and also do a fallback search for images/links
          const foundBtns = [];
          
          // 1. Check known selectors first
          const buttonTargets = [
              { id: 'btnEntrar', label: 'Entrar (Sin Cl@ve)', selectors: ['#btnEntrar', 'input[value="Entrar"]', 'input[name="btnEntrar"]'] },
              { id: 'btnClave', label: 'Acceder con Cl@ve', selectors: ['#btnEnviarClave', 'input[value*="Cl@ve"]', 'input[value*="Clave"]', 'input[name*="clave"]', 'img[alt*="Cl@ve"]', 'a[href*="clave"]', 'button[title*="Cl@ve"]', 'button[id*="clave"]', '.botonClave', '#clave'] },
              { id: 'btnAceptar', label: 'Aceptar', selectors: ['#btnAceptar', 'input[value="Aceptar"]'] },
              { id: 'btnSiguiente', label: 'Siguiente / Continuar', selectors: ['#btnSiguiente', 'input[value="Siguiente"]', 'input[value="Continuar"]'] }
          ];

          let idx = 0;
          for (const target of buttonTargets) {
              let foundForTarget = false;
              for (const sel of target.selectors) {
                  const elements = document.querySelectorAll(sel);
                  if (elements.length > 0) {
                      // Grab the first visible one
                      for (const el of Array.from(elements)) {
                          const rect = el.getBoundingClientRect();
                          if (rect.width > 0 && rect.height > 0) {
                              let finalSelector = sel;
                              if (el.id) {
                                  finalSelector = '#' + el.id;
                              } else if (el.name) {
                                  finalSelector = el.tagName.toLowerCase() + '[name="' + el.name + '"]';
                              } else {
                                  el.setAttribute('data-bot-id', 'fastbtn-' + idx);
                                  finalSelector = '[data-bot-id="fastbtn-' + idx + '"]';
                              }
                              
                              foundBtns.push({ 
                                  text: target.label, 
                                  selector: finalSelector, 
                                  index: idx 
                              });
                              idx++;
                              foundForTarget = true;
                              break; 
                          }
                      }
                      if (foundForTarget) break;
                  }
              }
          }
          
          // 2. If Clave still wasn't found, look through ALL images and buttons for the word "cl@ve" or "clave"
          const claveAlreadyFound = foundBtns.some(b => b.text.includes('Cl@ve'));
          if (!claveAlreadyFound) {
              const allElements = document.querySelectorAll('img, button, input[type="image"], a');
              for (const el of Array.from(allElements)) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                      const text = (el.alt || el.title || el.src || el.href || el.innerText || el.value || '').toLowerCase();
                      if (text.includes('cl@ve') || text.includes('clave')) {
                          let finalSelector = '';
                          if (el.id) {
                              finalSelector = '#' + el.id;
                          } else {
                              el.setAttribute('data-bot-id', 'fastbtn-fallback-' + idx);
                              finalSelector = '[data-bot-id="fastbtn-fallback-' + idx + '"]';
                          }
                          foundBtns.push({ 
                              text: 'Acceder con Cl@ve (Found via Scan)', 
                              selector: finalSelector, 
                              index: idx 
                          });
                          idx++;
                          break;
                      }
                  }
              }
          }
          
          return foundBtns;
      });`;
    
    code = code.replace(evalRegex, newEval.replace('dynamicButtons', filePath.includes('handleDynamicClick') ? 'newDynamicButtons' : 'dynamicButtons'));
    fs.writeFileSync(filePath, code);
}

updateScraper('src/automation/handleTramiteSelection.ts');
updateScraper('src/automation/handleDynamicClick.ts');
console.log("Patched aggressive Cl@ve finder");
