const fs = require('fs');
let code = fs.readFileSync('src/automation/handleContactInfo.ts', 'utf8');

const target = `            setVal('input[type="email"]:not([id*="Repite"])', data.email);
            setVal('input[name="txtCorreoElectronico"]', data.email);
            
            setVal('#txtRepiteCorreoElectronico', data.email);
            setVal('input[name="txtRepiteCorreoElectronico"]', data.email);`;

const replacement = `            setVal('input[type="email"]:not([id*="Repite"]):not([name*="Repite"])', data.email);
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

code = code.replace(target, replacement);

fs.writeFileSync('src/automation/handleContactInfo.ts', code);
console.log("Updated contact info repeat email logic.");
