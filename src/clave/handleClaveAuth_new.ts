// This is a temporary file to show the corrected logic structure
// The section from line ~379 onwards should be replaced with this approach

// After pageDiagnostics is collected...

console.log("[CLAVE] PAGE TITLE:", pageDiagnostics.title);
console.log("[CLAVE] BODY TEXT PREVIEW (first 500 chars):", pageDiagnostics.bodyText);
console.log("[CLAVE] VISIBLE BUTTONS:", JSON.stringify(pageDiagnostics.buttons, null, 2));
console.log("[CLAVE] VISIBLE LINKS:", JSON.stringify(pageDiagnostics.links, null, 2));
console.log("[CLAVE] INPUTS:", JSON.stringify(pageDiagnostics.inputs, null, 2));
console.log("[CLAVE] FORMS:", JSON.stringify(pageDiagnostics.forms, null, 2));
console.log("[CLAVE] IFRAMES:", JSON.stringify(pageDiagnostics.iframes, null, 2));
console.log("[CLAVE] VISIBLE ELEMENTS WITH KEYWORDS:", JSON.stringify(pageDiagnostics.visibleElements, null, 2));

const relevantHrefs = pageDiagnostics.links.map(l => l.href).filter(h => h && h.length > 0);
const relevantActions = pageDiagnostics.forms.map(f => f.action).filter(a => a && a.length > 0);
console.log("[CLAVE] RELEVANT HREFS:", relevantHrefs);
console.log("[CLAVE] RELEVANT FORM ACTIONS:", relevantActions);
console.log("[CLAVE] ========================================");

// Take diagnostic screenshot
console.log("[CLAVE] Taking diagnostic screenshot...");
const diagnosticScreenshot = await newPage.screenshot({
  timeout: 30000,
  type: "jpeg",
  quality: 70,
  fullPage: true
});
await bot.sendPhoto(chatId, diagnosticScreenshot, {
  caption: `📊 Page After Certificate Load\n\nURL: ${urlAfterLoad}\nTitle: ${pageDiagnostics.title}\nButtons: ${pageDiagnostics.buttons.length}\nLinks: ${pageDiagnostics.links.length}`,
});

// === INTELLIGENT PAGE STATE DETECTION ===
console.log("[CLAVE] Analyzing page state...");

const isAppointmentPage =
  urlAfterLoad.includes('solicitar') ||
  urlAfterLoad.includes('tramite') ||
  urlAfterLoad.includes('cita') ||
  pageDiagnostics.bodyText.toLowerCase().includes('solicitar cita') ||
  pageDiagnostics.bodyText.toLowerCase().includes('selecciona provincia');

const isErrorPage =
  pageDiagnostics.bodyText.toLowerCase().includes('error') ||
  pageDiagnostics.bodyText.toLowerCase().includes('no autorizado') ||
  pageDiagnostics.bodyText.toLowerCase().includes('acceso denegado');

const isICPPage = urlAfterLoad.includes('icp.administracionelectronica.gob.es');

// Check for automatic redirect
const hasMetaRefresh = await newPage.evaluate(() => {
  const meta = document.querySelector('meta[http-equiv="refresh"]');
  return meta ? meta.getAttribute('content') : null;
});

console.log("[CLAVE] Page State:");
console.log("[CLAVE]   - Is Appointment Page:", isAppointmentPage);
console.log("[CLAVE]   - Is Error Page:", isErrorPage);
console.log("[CLAVE]   - Is ICP Page:", isICPPage);
console.log("[CLAVE]   - Has Meta Refresh:", hasMetaRefresh);

// Handle different page states
if (isErrorPage) {
  console.log("[CLAVE] ERROR: Authentication failed - error page detected");
  await bot.sendMessage(chatId, `❌ Cl@ve authentication failed\n\nURL: ${urlAfterLoad}\nReason: Error page detected - certificate may have been rejected`);
  await newContext.close().catch(() => {});
  return;
}

if (isAppointmentPage) {
  console.log("[CLAVE] ✅ Already on appointment page - authentication successful!");
  await bot.sendMessage(chatId, "✅ Cl@ve certificate authentication successful!");
  // Continue to scraping below
} else if (hasMetaRefresh) {
  console.log("[CLAVE] Detected meta refresh, waiting for automatic redirect...");
  await bot.sendMessage(chatId, "⏳ Page is redirecting...");
  await newPage.waitForTimeout(5000);
  console.log("[CLAVE] Navigation: FROM:", urlAfterLoad, "TO:", newPage.url());
} else if (isICPPage) {
  console.log("[CLAVE] On ICP page - waiting for automatic certificate authentication...");
  await bot.sendMessage(chatId, "⏳ Waiting for certificate authentication...");
  await newPage.waitForTimeout(5000);

  const urlAfterWait = newPage.url();
  console.log("[CLAVE] Navigation after wait: FROM:", urlAfterLoad, "TO:", urlAfterWait);

  if (urlAfterWait !== urlAfterLoad) {
    console.log("[CLAVE] Page navigated - certificate authentication may have occurred");
  } else if (pageDiagnostics.buttons.length > 0 || pageDiagnostics.forms.length > 0) {
    console.log("[CLAVE] No automatic navigation - attempting to interact with page elements");

    // Try clicking first button or submitting form
    if (pageDiagnostics.buttons.length > 0) {
      const btn = pageDiagnostics.buttons[0];
      console.log("[CLAVE] Clicking button:", btn.text);
      await bot.sendMessage(chatId, `🖱️ Clicking: ${btn.text}`);

      try {
        if (btn.id) {
          await newPage.click(`#${btn.id}`);
        } else {
          await newPage.evaluate((btnText) => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
            const target = buttons.find(b => b.textContent?.includes(btnText) || (b as HTMLInputElement).value?.includes(btnText));
            if (target) (target as HTMLElement).click();
          }, btn.text);
        }
        await newPage.waitForTimeout(3000);
      } catch (e: any) {
        console.log("[CLAVE] Button click failed:", e.message);
      }
    } else if (pageDiagnostics.forms.length > 0) {
      console.log("[CLAVE] Submitting form");
      await newPage.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });
      await newPage.waitForTimeout(3000);
    }
  }
}

// Final URL check
const finalUrl = newPage.url();
console.log("[CLAVE] FINAL URL:", finalUrl);
console.log("[CLAVE] Final title:", await newPage.title());

// Check authentication state
const authSuccess = finalUrl.includes('solicitar') || finalUrl.includes('tramite') || finalUrl.includes('cita');
console.log("[CLAVE] Authentication state:", authSuccess ? "SUCCESS" : "UNCERTAIN");

if (authSuccess) {
  await bot.sendMessage(chatId, "✅ Cl@ve authentication successful! Continuing...");
} else {
  await bot.sendMessage(chatId, `⚠️ Authentication completed but state uncertain\n\nCurrent URL: ${finalUrl}`);
}

// Continue with page scraping...
