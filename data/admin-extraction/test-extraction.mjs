/**
 * TEST EXTRACTION SCRIPT
 *
 * This is a minimal example demonstrating the extraction contract.
 *
 * Contract:
 * - Must export an async function named 'extract'
 * - Function receives a Playwright 'page' object
 * - Function returns extraction results (any type)
 *
 * Usage:
 * 1. Upload this file to the bot as an admin
 * 2. Click "💾 Admin: Scrape Data (Launch Browser)"
 * 3. After browser loads, click "🤖 Run Custom Extraction"
 */

export async function extract(page) {
    console.log('[TEST EXTRACTION] Running test extraction...');

    // Basic page information
    const url = page.url();
    const title = await page.title();

    // Extract visible text from body (first 500 chars)
    const bodyText = await page.evaluate(() => {
        const body = document.body;
        return body ? body.innerText.substring(0, 500) : '';
    });

    // Count all links on page
    const linkCount = await page.evaluate(() => {
        return document.querySelectorAll('a').length;
    });

    // Return structured data
    return {
        success: true,
        timestamp: new Date().toISOString(),
        page_info: {
            url: url,
            title: title,
            link_count: linkCount
        },
        body_preview: bodyText,
        message: "Test extraction completed successfully!"
    };
}
