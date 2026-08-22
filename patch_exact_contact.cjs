const fs = require('fs');
let code = fs.readFileSync('src/automation/handleContactInfo.ts', 'utf8');

const target = `            setVal('input[type="email"]:not([id*="Repite"]):not([name*="Repite"])', data.email);
            setVal('input[name="txtCorreoElectronico"]', data.email);
            
            setVal('#txtRepiteCorreoElectronico', data.email);
            setVal('input[name="txtRepiteCorreoElectronico"]', data.email);
            
            // Aggressive fallback to find the repeat email field if ID/Name is slightly different
            const emailInputs = Array.from(document.querySelectorAll('input[type="email"], input[name*="correo" i], input[id*="correo" i]'));
            if (emailInputs.length >= 2) {
                // Usually the first is email, second is repeat email
                emailInputs[0].value = data.email;
                emailInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                emailInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                
                emailInputs[1].value = data.email;
                emailInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
                emailInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
            }`;

const replacement = `            // First Email Field
            setVal('input[type="email"]:not([id*="DOS"])', data.email);
            setVal('input[name="txtCorreoElectronico"]', data.email);
            setVal('#email', data.email);
            
            // Second (Repeat) Email Field with exact IDs provided
            setVal('#emailDOS', data.email);
            setVal('input[name="emailDOS"]', data.email);
            
            // Old fallback just in case
            setVal('#txtRepiteCorreoElectronico', data.email);
            setVal('input[name="txtRepiteCorreoElectronico"]', data.email);
            
            // Also explicitly find element by id and set it
            const emailDosEl = document.getElementById('emailDOS') as HTMLInputElement;
            if (emailDosEl) {
                emailDosEl.value = data.email;
                emailDosEl.dispatchEvent(new Event('input', { bubbles: true }));
                emailDosEl.dispatchEvent(new Event('change', { bubbles: true }));
            }`;

code = code.replace(target, replacement);

const targetBtn = `        const btnSelector = '#btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]';`;
const replacementBtn = `        const btnSelector = '#btnSiguiente, input[value="Next "], input[value="Siguiente"], input[name="btnSiguiente"]';`;
code = code.replace(targetBtn, replacementBtn);

fs.writeFileSync('src/automation/handleContactInfo.ts', code);
console.log("Patched contact info with exact HTML IDs.");
