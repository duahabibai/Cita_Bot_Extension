const fs = require('fs');
let code = fs.readFileSync('src/automation/handleFormFill.ts', 'utf8');

const replacement = `
        await page.evaluate((data: any) => {
            const setVal = (sel: string, val: string) => {
                const el = document.querySelector(sel) as HTMLInputElement;
                if (el && val) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            };
            
            // Try common ID selectors
            setVal('#txtIdCitado', data.nie);
            // Try common Name selectors
            setVal('#txtDesCitado', data.name);
            // Try common Country of Nationality select if needed (not all forms have it)
            setVal('#txtPaisNac', data.countryNac);
            
        }, globalAutofillData);
`;

code = code.replace(
  `        await page.evaluate((data: any) => {
            const setVal = (sel: string, val: string) => {
                const el = document.querySelector(sel) as HTMLInputElement;
                if (el && val) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            };
            
            // Try common ID selectors
            setVal('#txtIdCitado', data.nie);
            // Try common Name selectors
            setVal('#txtDesCitado', data.name);
            
        }, globalAutofillData);`,
  replacement
);
fs.writeFileSync('src/automation/handleFormFill.ts', code);
