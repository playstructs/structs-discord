const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Image generation service using Puppeteer
 * @module services/imageGenerator
 */

let browserInstance = null;
let pagePool = [];
const MAX_POOL_SIZE = 5;

/**
 * Initialize browser instance (singleton)
 * @returns {Promise<void>}
 */
async function initBrowser() {
    if (browserInstance) {
        return;
    }

    browserInstance = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });

    // Create initial page pool
    for (let i = 0; i < MAX_POOL_SIZE; i++) {
        const page = await browserInstance.newPage();
        pagePool.push(page);
    }
}

/**
 * Get a page from the pool
 * @returns {Promise<Object>} Puppeteer page
 */
async function getPage() {
    await initBrowser();
    
    if (pagePool.length > 0) {
        return pagePool.pop();
    }
    
    // If pool is empty, create new page
    return await browserInstance.newPage();
}

/**
 * Return a page to the pool
 * @param {Object} page - Puppeteer page
 */
function returnPage(page) {
    if (pagePool.length < MAX_POOL_SIZE) {
        pagePool.push(page);
    } else {
        page.close();
    }
}

/**
 * Load SUI CSS files
 * @returns {Promise<string>} Combined CSS content
 */
async function loadSUICSS() {
    const webappPath = path.join(__dirname, '../../.agents/repositories/structs-webapp/src/public/css');
    
    const cssFiles = [
        path.join(webappPath, 'sui/sui.css'),
        path.join(webappPath, 'main.css')
    ];
    
    let combinedCSS = '';
    
    for (const cssFile of cssFiles) {
        try {
            const cssContent = await fs.readFile(cssFile, 'utf8');
            combinedCSS += cssContent + '\n';
        } catch (error) {
            console.warn(`Failed to load CSS file ${cssFile}:`, error.message);
        }
    }
    
    // Rewrite image paths to absolute file paths
    const webappImgPath = path.join(__dirname, '../../.agents/repositories/structs-webapp/src/public/img');
    combinedCSS = rewriteCSSPaths(combinedCSS, webappImgPath);
    
    return combinedCSS;
}

/**
 * Rewrite CSS image paths to absolute file paths
 * @param {string} css - CSS content
 * @param {string} basePath - Base path for images
 * @returns {string} CSS with rewritten paths
 */
function rewriteCSSPaths(css, basePath) {
    // Replace /img/ paths with absolute file:// paths
    // Handle both url() and url('') formats
    return css.replace(/url\(['"]?\/img\/([^'"]+)['"]?\)/g, (match, imgPath) => {
        const absolutePath = path.join(basePath, imgPath).replace(/\\/g, '/');
        // Use file:// protocol for local files
        return `url('file://${absolutePath}')`;
    });
}

/**
 * Create complete HTML document
 * @param {string} htmlContent - Main HTML content
 * @param {string} cssContent - CSS content
 * @returns {string} Complete HTML document
 */
function createHTMLDocument(htmlContent, cssContent) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${cssContent}
        
        /* Override for image generation */
        body {
            margin: 0;
            padding: 20px;
            background: var(--surface-default, #1a1a1a);
            color: var(--text-body, #ffffff);
            font-family: 'ExtremeHazard', 'Arial', sans-serif;
        }
        
        .sui-cheatsheet {
            min-width: 400px;
            max-width: 400px;
            background: var(--surface-default, #1a1a1a);
        }
        
        /* Ensure struct images are visible */
        .struct-still {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .struct-still img {
            max-width: 100%;
            max-height: 100%;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;
}

/**
 * Generate cheatsheet image from HTML
 * @param {string} htmlContent - HTML content to render
 * @param {Object} options - Generation options
 * @param {number} options.width - Image width (default: 800)
 * @param {number} options.height - Image height (default: auto)
 * @param {string} options.format - Image format: 'png' or 'jpeg' (default: 'png')
 * @returns {Promise<Buffer>} Image buffer
 */
async function generateCheatsheetImage(htmlContent, options = {}) {
    const {
        width = 800,
        height = null,
        format = 'png'
    } = options;
    
    const page = await getPage();
    
    try {
        // Load CSS
        const cssContent = await loadSUICSS();
        
        // Create complete HTML document
        const fullHTML = createHTMLDocument(htmlContent, cssContent);
        
        // Set viewport
        await page.setViewport({
            width: width,
            height: height || 1200,
            deviceScaleFactor: 2 // Higher quality
        });
        
        // Set content
        await page.setContent(fullHTML, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Wait for images to load
        await page.evaluate(() => {
            return Promise.all(
                Array.from(document.images).map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        setTimeout(reject, 5000);
                    });
                })
            );
        }).catch(() => {
            // Some images may fail to load, continue anyway
        });
        
        // Take screenshot
        const screenshot = await page.screenshot({
            type: format,
            fullPage: true,
            clip: height ? null : undefined
        });
        
        return screenshot;
    } finally {
        returnPage(page);
    }
}

/**
 * Close browser instance (cleanup)
 * @returns {Promise<void>}
 */
async function closeBrowser() {
    if (browserInstance) {
        // Close all pages in pool
        for (const page of pagePool) {
            await page.close().catch(() => {});
        }
        pagePool = [];
        
        await browserInstance.close();
        browserInstance = null;
    }
}

module.exports = {
    generateCheatsheetImage,
    initBrowser,
    closeBrowser
};

