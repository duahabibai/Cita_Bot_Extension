const fs = require('fs');

function updateScraper(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    const evalRegex = /\/\/ Scroll to bottom so screenshot shows the buttons[\s\S]*?return uniqueBtns;\n      \}\);/g;
    
    const newEval = `// Scroll to bottom so screenshot shows the buttons
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      
      const dynamicButtons = await page.evaluate(() => {
          const foundBtns = [];
          
          // Known selectors for Extranjeria
          const buttonTargets = [
              { id: 'btnEntrar', label: 'Entrar (Sin Cl@ve)', selectors: ['#btnEntrar', 'input[value="Entrar"]', 'input[name="btnEntrar"]'] },
              { id: 'btnClave', label: 'Acceder con Cl@ve', selectors: ['#btnEnviarClave', 'input[value*="Cl@ve"]', 'input[value*="Clave"]', 'img[alt*="Cl@ve"]'] },
              { id: 'btnAceptar', label: 'Aceptar', selectors: ['#btnAceptar', 'input[value="Aceptar"]'] },
              { id: 'btnSiguiente', label: 'Siguiente / Continuar', selectors: ['#btnSiguiente', 'input[value="Siguiente"]', 'input[value="Continuar"]'] }
          ];

          let idx = 0;
          for (const target of buttonTargets) {
              for (const sel of target.selectors) {
                  const el = document.querySelector(sel);
                  if (el) {
                      // Generate a unique selector for this specific element
                      let finalSelector = sel;
                      if (el.id) {
                          finalSelector = '#' + el.id;
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
                      break; // Found one for this target category, move to next target
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
console.log("Patched targeted scrapers");
