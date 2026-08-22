# Updated Cl@ve Flow (On-Demand Certificate)

The user wants the bot to ask for the certificate *only* when the "Acceder con Cl@ve" button is clicked, not at the start.

### The New Flow:
1. User receives the list of buttons (e.g. "Entrar (Sin Cl@ve)", "Acceder con Cl@ve").
2. User clicks the Telegram button "Acceder con Cl@ve".
3. **Instead of immediately clicking on the webpage**, the bot pauses and checks if a certificate is already loaded in memory for this session.
4. **If NO certificate:**
   - Bot pauses the web session.
   - Bot replies on Telegram: "Bhai, Cl@ve mein jaane ke liye apni `.p12` file bhejo."
   - Bot waits for file upload.
   - Bot asks: "Password bhejo bhai."
   - Bot waits for password.
   - Bot converts the `.p12` to `.pem` instantly.
   - **Crucial Step:** Playwright contexts cannot dynamically inject client certificates *after* they are launched without restarting the context.
   - **Solution:** We will save the cert+pass, close the current page, spawn a *new context* with the `clientCertificates` attached, and quickly navigate back to the same URL, *then* click the Cl@ve button automatically.
5. **If YES certificate (already provided earlier):**
   - It proceeds to click "Acceder con Cl@ve" immediately.

### Action Plan
- Modify `handleDynamicClick.ts` to intercept `btnAccesoClave`.
- Add state management `session.waitingForCert = true` and `session.waitingForCertPassword = true`.
- Update the main telegram message handler to process `.p12` documents and text passwords if these state flags are true.
