const fs = require('fs');

function updateScraper(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    const evalRegex = /const (newD|d)ynamicButtons = await page\.evaluate\(\(\) => \{[\s\S]*?\}\);/g;
    
    const newEval = `
      // Scroll to bottom so screenshot shows the buttons
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      
      const $1ynamicButtons = await page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('a, button, input'));
          const btns = [];
          
          allElements.forEach((el, idx) => {
              const htmlEl = el;
              let text = (htmlEl.innerText || htmlEl.value || htmlEl.textContent || '').trim().replace(/\\s+/g, ' ');
              const textLower = text.toLowerCase();
              
              if (textLower.includes('entrar') || 
                  textLower.includes('aceptar') || 
                  textLower.includes('cl@ve') || 
                  textLower.includes('clave') || 
                  textLower.includes('acceder') || 
                  textLower.includes('continuar') || 
                  textLower.includes('siguiente')) {
                  
                  let selector = '';
                  if (htmlEl.id) {
                      selector = '#' + htmlEl.id;
                  } else if (htmlEl.name) {
                      selector = htmlEl.tagName.toLowerCase() + '[name="' + htmlEl.name + '"]';
                  } else {
                      htmlEl.setAttribute('data-bot-id', 'btn-' + idx);
                      selector = '[data-bot-id="btn-' + idx + '"]';
                  }
                  
                  const txtArea = document.createElement('textarea');
                  txtArea.innerHTML = text;
                  text = txtArea.value;
                  
                  btns.push({ text: text.substring(0, 35), selector, index: idx });
              }
          });
          
          const uniqueBtns = [];
          const seen = new Set();
          for (const b of btns) {
              if (!seen.has(b.text)) {
                  seen.add(b.text);
                  uniqueBtns.push(b);
              }
          }
          return uniqueBtns;
      });`;
    
    code = code.replace(evalRegex, newEval);
    fs.writeFileSync(filePath, code);
}

updateScraper('src/automation/handleTramiteSelection.ts');
updateScraper('src/automation/handleDynamicClick.ts');
console.log("Patched scrapers");
