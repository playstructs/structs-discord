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
    const webappPath = path.join(__dirname, '../../assets/css');
    const webappFontPath = path.join(__dirname, '../../assets/fonts');
    
    const cssFiles = [
        path.join(webappPath, 'structicons.css'), // Load structicons first so font is available
        path.join(webappPath, 'sui/sui.css'),
        path.join(webappPath, 'main.css')
    ];
    
    let combinedCSS = '';
    const cssFilePaths = [];
    
    for (const cssFile of cssFiles) {
        try {
            const cssContent = await fs.readFile(cssFile, 'utf8');
            combinedCSS += cssContent + '\n';
            cssFilePaths.push(cssFile);
        } catch (error) {
            console.warn(`Failed to load CSS file ${cssFile}:`, error.message);
        }
    }
    
    // Rewrite image and font paths
    // For relative paths, we need to know which CSS file they came from
    // Since we're combining CSS, we'll resolve relative paths from the public/css directory
    const webappImgPath = path.join(__dirname, '../../assets/img');
    const publicPath = path.join(__dirname, '../../assets');
    
    // Process each CSS file separately to resolve relative paths correctly
    let processedCSS = '';
    for (let i = 0; i < cssFiles.length; i++) {
        const cssFile = cssFiles[i];
        if (cssFilePaths.includes(cssFile)) {
            // Read the file again to process it individually
            const cssContent = await fs.readFile(cssFile, 'utf8');
            // Resolve relative paths from the CSS file's location
            const processed = await rewriteCSSPaths(cssContent, webappImgPath, webappFontPath, cssFile);
            processedCSS += processed + '\n';
        }
    }
    
    return processedCSS;
}

/**
 * Convert font file to base64 data URI
 * @param {string} fontPath - Path to font file
 * @returns {Promise<string>} Base64 data URI
 */
async function fontToDataURI(fontPath) {
    try {
        const fontBuffer = await fs.readFile(fontPath);
        const fontBase64 = fontBuffer.toString('base64');
        const ext = path.extname(fontPath).toLowerCase();
        
        let mimeType = 'application/octet-stream';
        if (ext === '.woff') mimeType = 'font/woff';
        else if (ext === '.woff2') mimeType = 'font/woff2';
        else if (ext === '.ttf') mimeType = 'font/ttf';
        else if (ext === '.otf') mimeType = 'font/otf';
        else if (ext === '.eot') mimeType = 'application/vnd.ms-fontobject';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        
        return `data:${mimeType};charset=utf-8;base64,${fontBase64}`;
    } catch (error) {
        console.warn(`Failed to load font ${fontPath}:`, error.message);
        return null;
    }
}

/**
 * Convert image file to base64 data URI
 * @param {string} imgPath - Path to image file
 * @returns {Promise<string>} Base64 data URI
 */
async function imageToDataURI(imgPath) {
    try {
        const imgBuffer = await fs.readFile(imgPath);
        const imgBase64 = imgBuffer.toString('base64');
        const ext = path.extname(imgPath).toLowerCase();
        
        let mimeType = 'image/png'; // Default
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        else if (ext === '.webp') mimeType = 'image/webp';
        
        return `data:${mimeType};base64,${imgBase64}`;
    } catch (error) {
        console.warn(`Failed to load image ${imgPath}:`, error.message);
        return null;
    }
}

/**
 * Rewrite CSS image and font paths
 * @param {string} css - CSS content
 * @param {string} imgBasePath - Base path for images
 * @param {string} fontBasePath - Base path for fonts
 * @returns {Promise<string>} CSS with rewritten paths
 */
async function rewriteCSSPaths(css, imgBasePath, fontBasePath, cssFilePath = null) {
    // Replace /img/ paths with base64 data URIs for better Puppeteer compatibility
    const imgMatches = Array.from(css.matchAll(/url\(['"]?\/img\/([^'"]+?)(\?[^'"]*)?['"]?\)/g));
    const imgReplacements = [];
    
    for (const match of imgMatches) {
        const imgPath = match[1]; // Image path without query params
        const fullImgPath = path.join(imgBasePath, imgPath);
        const dataURI = await imageToDataURI(fullImgPath);
        
        if (dataURI) {
            imgReplacements.push({
                original: match[0],
                replacement: `url('${dataURI}')`
            });
        }
    }
    
    // Apply all image replacements
    for (const replacement of imgReplacements) {
        css = css.replace(replacement.original, replacement.replacement);
    }
    
    // Replace font paths - handle both absolute (/fonts/) and relative (../../fonts/) paths
    // Pattern 1: Absolute paths like url('/fonts/Structicons.eot?471nh8') or url('/fonts/Structicons.eot?471nh8#iefix')
    // This pattern captures the URL including query params and hash fragments, stopping before format() or closing paren
    const absoluteFontMatches = Array.from(css.matchAll(/url\(['"]?(\/fonts\/[^'")]+?)(?:\s*format\([^)]+\))?['"]?\s*\)/g));
    // Pattern 2: Relative paths like url(../../fonts/sui/DirectiveZeroWid.ttf)
    const relativeFontMatches = Array.from(css.matchAll(/url\(['"]?((?:\.\.\/)+fonts\/[^'")]+?)(?:\s*format\([^)]+\))?['"]?\s*\)/g));
    
    const fontReplacements = [];
    
    // Process absolute font paths
    for (const match of absoluteFontMatches) {
        let fontPath = match[1]; // Font path (e.g., /fonts/Structicons.eot?471nh8#iefix)
        // Remove query params and hash fragments for file lookup
        const fontPathForFile = fontPath.split('?')[0].split('#')[0]; // e.g., /fonts/Structicons.eot
        const fullFontPath = path.join(fontBasePath, fontPathForFile.replace(/^\/fonts\//, ''));
        const dataURI = await fontToDataURI(fullFontPath);
        
        if (dataURI) {
            fontReplacements.push({
                original: match[0],
                replacement: `url('${dataURI}')`
            });
        }
    }
    
    // Process relative font paths
    for (const match of relativeFontMatches) {
        const relativeFontPath = match[1]; // e.g., ../../fonts/sui/DirectiveZeroWid.ttf
        // Resolve relative path: if CSS is at public/css/sui/sui.css, then ../../fonts/sui/ becomes public/fonts/sui/
        let fullFontPath;
        if (cssFilePath) {
            // Resolve relative to CSS file location
            // CSS file: public/css/sui/sui.css
            // Relative: ../../fonts/sui/DirectiveZeroWid.ttf
            // Result: public/fonts/sui/DirectiveZeroWid.ttf
            const cssDir = path.dirname(cssFilePath);
            fullFontPath = path.resolve(cssDir, relativeFontPath);
        } else {
            // Fallback: assume relative to public/css directory
            // ../../fonts/sui/ from css/sui/ = fonts/sui/ (relative to public/)
            const normalizedPath = relativeFontPath.replace(/^(\.\.\/)+fonts\//, 'fonts/');
            fullFontPath = path.join(path.dirname(fontBasePath), normalizedPath);
        }
        const dataURI = await fontToDataURI(fullFontPath);
        
        if (dataURI) {
            fontReplacements.push({
                original: match[0],
                replacement: `url('${dataURI}')`
            });
        }
    }
    
    // Apply all font replacements
    for (const replacement of fontReplacements) {
        css = css.replace(replacement.original, replacement.replacement);
    }
    
    return css;
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
        * {
            box-sizing: border-box;
        }
        
        html, body {
            margin: 0;
            padding: 0;
            background: transparent;
            color: var(--text-body, #C5D7D9);
            font-family: 'ExtremeHazard', 'Arial', sans-serif;
            width: fit-content;
            height: fit-content;
            overflow: hidden;
            display: inline-block;
        }
        
        /* Scale up the entire cheatsheet for better readability (3x scale) */
        .sui-cheatsheet {
            display: inline-flex;
            min-width: 200px;
            margin: 0;
            padding: 0;
            position: absolute;
            top: 0;
            left: 0;
            box-sizing: border-box;
            transform: scale(3);
            transform-origin: top left;
        }
        
        /* Ensure proper rendering with scale */
        body {
            display: inline-block;
            transform-origin: top left;
        }
        
        /* Ensure fonts render crisply at scale */
        .sui-cheatsheet * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
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
        
        // Set initial viewport - will be adjusted to scaled content size
        // With 3x scale, we need more space (estimate: 200px width * 3 = 600px, height varies)
        await page.setViewport({
            width: 800,
            height: 1500,
            deviceScaleFactor: 2 // Higher quality
        });
        
        // Set content with a more reliable wait strategy
        await page.setContent(fullHTML, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        // Wait for page to be ready and fonts to load
        await page.evaluate(() => {
            return new Promise((resolve) => {
                // Wait for DOM to be ready
                if (document.readyState === 'complete') {
                    // Wait for fonts to load
                    if (document.fonts && document.fonts.ready) {
                        document.fonts.ready.then(() => {
                            setTimeout(resolve, 100); // Small delay to ensure rendering
                        }).catch(() => {
                            setTimeout(resolve, 500); // Fallback if fonts fail
                        });
                    } else {
                        setTimeout(resolve, 500);
                    }
                } else {
                    window.addEventListener('load', () => {
                        // Wait for fonts after page load
                        if (document.fonts && document.fonts.ready) {
                            document.fonts.ready.then(() => {
                                setTimeout(resolve, 100);
                            }).catch(() => {
                                setTimeout(resolve, 500);
                            });
                        } else {
                            setTimeout(resolve, 500);
                        }
                    }, { once: true });
                    // Fallback timeout
                    setTimeout(resolve, 3000);
                }
            });
        });
        
        // Wait for images with a timeout, but don't fail if they don't load
        try {
            await page.evaluate(() => {
                return Promise.allSettled(
                    Array.from(document.images).map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise((resolve) => {
                            img.onload = resolve;
                            img.onerror = resolve; // Don't reject on error
                            setTimeout(resolve, 2000); // 2 second timeout per image
                        });
                    })
                );
            });
        } catch (error) {
            // Continue even if image loading fails
            console.warn('Some images may not have loaded:', error.message);
        }
        
        // Get the exact bounding box of the scaled cheatsheet element
        const clip = await page.evaluate(() => {
            const cheatsheet = document.querySelector('.sui-cheatsheet');
            if (!cheatsheet) return null;
            
            // Force layout recalculation
            cheatsheet.offsetHeight;
            
            const rect = cheatsheet.getBoundingClientRect();
            
            return {
                x: Math.max(0, Math.round(rect.x)),
                y: Math.max(0, Math.round(rect.y)),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };
        });
        
        if (!clip) {
            throw new Error('Could not find cheatsheet element');
        }
        
        // Set viewport to exactly match scaled content size with minimal padding
        // Account for any y offset by adding it to the height
        const yOffset = Math.max(0, clip.y);
        const viewportWidth = Math.ceil(clip.width) + 4;
        const viewportHeight = Math.ceil(clip.height) + yOffset + 4;
        await page.setViewport({
            width: viewportWidth,
            height: viewportHeight,
            deviceScaleFactor: 2
        });
        
        // Wait for viewport to adjust and ensure element is at top-left
        await page.evaluate(() => {
            const cheatsheet = document.querySelector('.sui-cheatsheet');
            if (cheatsheet) {
                // Ensure body and html have no margin/padding that could cause offset
                document.body.style.margin = '0';
                document.body.style.padding = '0';
                document.documentElement.style.margin = '0';
                document.documentElement.style.padding = '0';
                // Scroll to top to ensure element is visible
                window.scrollTo(0, 0);
                // Force a repaint
                cheatsheet.offsetHeight;
            }
        });
        
        await page.evaluate(() => {
            return new Promise(resolve => {
                // Wait for fonts and images to be ready
                if (document.fonts && document.fonts.ready) {
                    document.fonts.ready.then(() => {
                        // Wait a bit more for layout to settle
                        setTimeout(resolve, 300);
                    }).catch(() => setTimeout(resolve, 300));
                } else {
                    setTimeout(resolve, 300);
                }
            });
        });
        
        // Get final clip coordinates (should be at 0,0 now with adjusted viewport)
        const finalClip = await page.evaluate(() => {
            const cheatsheet = document.querySelector('.sui-cheatsheet');
            if (!cheatsheet) return null;
            
            cheatsheet.offsetHeight; // Force layout
            
            const rect = cheatsheet.getBoundingClientRect();
            
            // Use actual position, but ensure we're not clipping negative values
            return {
                x: Math.max(0, Math.round(rect.x)),
                y: Math.max(0, Math.round(rect.y)),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };
        });
        
        // Use final clip or fall back to original
        const clipToUse = finalClip || clip;
        
        // Use the actual clip coordinates - the element position after viewport adjustment
        // If there's still a y offset, we need to include it in the clip
        const screenshotClip = {
            x: clipToUse.x,
            y: clipToUse.y,
            width: clipToUse.width,
            height: clipToUse.height
        };
        
        // Ensure clip doesn't exceed viewport
        if (screenshotClip.x + screenshotClip.width > viewportWidth) {
            screenshotClip.width = viewportWidth - screenshotClip.x;
        }
        if (screenshotClip.y + screenshotClip.height > viewportHeight) {
            screenshotClip.height = viewportHeight - screenshotClip.y;
        }
        
        // Take screenshot - use clip if coordinates are valid and within viewport
        const useClip = screenshotClip.width > 0 && screenshotClip.height > 0 && 
                       screenshotClip.x >= 0 && screenshotClip.y >= 0 &&
                       screenshotClip.x + screenshotClip.width <= viewportWidth &&
                       screenshotClip.y + screenshotClip.height <= viewportHeight;
        
        const screenshot = await page.screenshot({
            type: format,
            ...(useClip ? { clip: screenshotClip } : {}),
            omitBackground: false
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

