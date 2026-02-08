/**
 * QR Lab - Platform Application
 * Educational QR code generation and learning tool
 */

// Global state
let currentQRCode = null;
let qrSettings = {
    targetUrl: 'https://example.com',
    size: 256,
    errorCorrection: 'M',
    fgColor: '#000000',
    bgColor: '#ffffff'
};

// Unsaved changes tracking for platform
window.hasUnsavedChanges = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    updateQRCode();
}

// Internal project loading (renamed to avoid collision with window.loadProjectData)
function _loadProjectSettings(data) {
    try {
        const projectData = typeof data === 'string' ? JSON.parse(data) : data;

        // Restore settings
        if (projectData.target_url) {
            qrSettings.targetUrl = projectData.target_url;
            document.getElementById('target-url').value = projectData.target_url;
        }

        if (projectData.settings) {
            if (projectData.settings.size) {
                qrSettings.size = projectData.settings.size;
                document.getElementById('qr-size').value = projectData.settings.size;
                document.getElementById('size-value').textContent = projectData.settings.size + 'px';
            }

            if (projectData.settings.error_correction) {
                qrSettings.errorCorrection = projectData.settings.error_correction;
                document.getElementById('error-correction').value = projectData.settings.error_correction;
            }

            if (projectData.settings.foreground_color) {
                qrSettings.fgColor = projectData.settings.foreground_color;
                document.getElementById('fg-color').value = projectData.settings.foreground_color;
            }

            if (projectData.settings.background_color) {
                qrSettings.bgColor = projectData.settings.background_color;
                document.getElementById('bg-color').value = projectData.settings.background_color;
            }
        }

        updateQRCode();
        console.log('Project loaded successfully');
    } catch (e) {
        console.error('Error loading project data:', e);
    }
}

function setupEventListeners() {
    // URL input
    const urlInput = document.getElementById('target-url');
    urlInput.addEventListener('input', debounce(function() {
        qrSettings.targetUrl = this.value;
        updateQRCode();
        window.hasUnsavedChanges = true;
    }, 500));

    // Size slider
    const sizeSlider = document.getElementById('qr-size');
    sizeSlider.addEventListener('input', function() {
        qrSettings.size = parseInt(this.value);
        document.getElementById('size-value').textContent = this.value + 'px';
        updateQRCode();
        window.hasUnsavedChanges = true;
    });

    // Error correction
    document.getElementById('error-correction').addEventListener('change', function() {
        qrSettings.errorCorrection = this.value;
        updateQRCode();
        window.hasUnsavedChanges = true;
    });

    // Colors - instant update on input (not just change)
    document.getElementById('fg-color').addEventListener('input', function() {
        qrSettings.fgColor = this.value;
        updateQRCode();
        window.hasUnsavedChanges = true;
    });

    document.getElementById('bg-color').addEventListener('input', function() {
        qrSettings.bgColor = this.value;
        updateQRCode();
        window.hasUnsavedChanges = true;
    });

    // Close modal on background click
    document.getElementById('help-modal').addEventListener('click', function(e) {
        if (e.target === this) closeHelp();
    });

    document.getElementById('export-modal').addEventListener('click', function(e) {
        if (e.target === this) closeExportModal();
    });
}

// QR Code Generation
function updateQRCode() {
    const preview = document.getElementById('qr-preview');
    preview.innerHTML = ''; // Clear existing QR code

    try {
        currentQRCode = new QRCode(preview, {
            text: qrSettings.targetUrl,
            width: qrSettings.size,
            height: qrSettings.size,
            colorDark: qrSettings.fgColor,
            colorLight: qrSettings.bgColor,
            correctLevel: QRCode.CorrectLevel[qrSettings.errorCorrection]
        });

        // Wait for QR code to be generated, then detect version
        setTimeout(() => {
            detectQRVersion();
        }, 100);
    } catch (e) {
        console.error('Error generating QR code:', e);
        showToast('Error generating QR code', 'error');
    }
}

function detectQRVersion() {
    const url = qrSettings.targetUrl;
    if (!url) return;
    const ecLevel = qrSettings.errorCorrection || 'M';

    // Byte capacity table for each version at different EC levels
    const byteCapacity = {
        L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858],
        M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450, 504, 560, 624, 666],
        Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292, 322, 364, 394, 442, 482],
        H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220, 250, 280, 310, 338, 382]
    };

    const urlLength = url.length;
    let version = 1;

    // Find the minimum version that can hold this data
    const capacities = byteCapacity[ecLevel];
    for (let i = 0; i < capacities.length; i++) {
        if (urlLength <= capacities[i]) {
            version = i + 1;
            break;
        }
    }

    // If URL is too long for version 20, estimate higher versions
    if (version === 1 && urlLength > capacities[capacities.length - 1]) {
        version = Math.min(40, 20 + Math.ceil((urlLength - capacities[19]) / 100));
    }

    const modules = 17 + (version * 4);
    const capacity = capacities[version - 1] || capacities[capacities.length - 1];

    // Update display
    document.getElementById('qr-version-display').textContent = 'Version ' + version;
    document.getElementById('qr-modules-display').textContent = modules + '\u00d7' + modules;
    document.getElementById('qr-capacity-display').textContent = capacity + ' bytes';
    document.getElementById('qr-info-display').style.display = 'block';
}

function getQRCapacity(version, ecLevel) {
    const capacityTable = {
        L: [41, 77, 127, 187, 255, 322, 370, 461, 552, 652],
        M: [34, 63, 101, 149, 202, 255, 293, 365, 432, 513],
        Q: [27, 48, 77, 111, 144, 178, 207, 259, 312, 364],
        H: [17, 34, 58, 82, 106, 139, 154, 202, 235, 288]
    };

    if (version <= 10) {
        return capacityTable[ecLevel][version - 1];
    } else {
        return Math.round(capacityTable[ecLevel][9] * (version / 10));
    }
}

// Show export modal
function showExportModal() {
    const qrCanvas = document.querySelector('#qr-preview canvas');
    if (!qrCanvas) {
        showToast('No QR code to export', 'error');
        return;
    }
    document.getElementById('export-modal').style.display = 'flex';
}

function closeExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}

// Export to computer (download)
function exportToComputer() {
    const qrCanvas = document.querySelector('#qr-preview canvas');
    if (!qrCanvas) {
        showToast('No QR code to export', 'error');
        return;
    }

    const link = document.createElement('a');
    link.download = 'qrcode-' + Date.now() + '.png';
    link.href = qrCanvas.toDataURL('image/png');
    link.click();

    closeExportModal();
    showToast('QR Code downloaded!', 'success');
}

// Help system
function showHelp(topic) {
    const helpContent = getHelpContent(topic);
    document.getElementById('help-title').textContent = helpContent.title;
    document.getElementById('help-content').innerHTML = helpContent.content;
    document.getElementById('help-modal').style.display = 'flex';
}

function closeHelp() {
    document.getElementById('help-modal').style.display = 'none';
}

function getHelpContent(topic) {
    const content = {
        'what-is-qr': {
            title: 'What is a QR Code?',
            content: `
                <h3>Quick Response Code - A Revolutionary Invention</h3>
                <p><strong>QR</strong> stands for <strong>Quick Response</strong>, and these codes were designed to be scanned rapidly and decode information instantly.</p>

                <h3>The Origin Story (1994)</h3>
                <p>QR codes were invented by <strong>Masahiro Hara</strong> and his team at <strong>Denso Wave</strong>, a subsidiary of Toyota, in Japan. Here's why they created them:</p>

                <div style="background: rgba(147, 51, 234, 0.1); padding: 15px; border-left: 3px solid #9333ea; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 0;"><strong>The Problem:</strong></p>
                    <p style="margin: 8px 0 0;">Toyota's manufacturing plants were tracking thousands of automotive parts. Traditional barcodes could only hold about 20 characters, so they needed to scan multiple barcodes on each part. This was slow, error-prone, and inefficient on busy assembly lines.</p>
                </div>

                <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-left: 3px solid #10b981; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 0;"><strong>The Solution:</strong></p>
                    <p style="margin: 8px 0 0;">Hara's team developed a 2D code that could hold <strong>over 7,000 characters</strong> - more than 350 times the capacity of traditional barcodes! It could be scanned from any angle and decoded in milliseconds.</p>
                </div>

                <h3>QR Codes vs Barcodes</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr style="background: rgba(147, 51, 234, 0.2);">
                        <th style="padding: 10px; text-align: left; border: 1px solid rgba(255,255,255,0.1);">Feature</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid rgba(255,255,255,0.1);">Traditional Barcode</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid rgba(255,255,255,0.1);">QR Code</th>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);"><strong>Data Capacity</strong></td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">~20 characters</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">7,089 characters</td>
                    </tr>
                    <tr style="background: rgba(255,255,255,0.02);">
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);"><strong>Dimensions</strong></td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">1D (horizontal only)</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">2D (horizontal & vertical)</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);"><strong>Scan Direction</strong></td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Must scan horizontally</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Any angle (360)</td>
                    </tr>
                    <tr style="background: rgba(255,255,255,0.02);">
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);"><strong>Error Correction</strong></td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">None</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Up to 30% damage recovery</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);"><strong>Data Types</strong></td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Numbers only</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Numbers, text, URLs, binary</td>
                    </tr>
                </table>

                <h3>How QR Codes Took Over the World</h3>
                <p><strong>1994-2000:</strong> Used primarily in Japanese automotive and manufacturing</p>
                <p><strong>2000-2010:</strong> Adopted by logistics and shipping industries worldwide</p>
                <p><strong>2010-2015:</strong> Smartphones with built-in cameras made scanning accessible</p>
                <p><strong>2017:</strong> Apple iOS 11 added native QR scanning to camera app (no app needed!)</p>
                <p><strong>2020:</strong> COVID-19 pandemic accelerated adoption for contactless menus, payments, and check-ins</p>
                <p><strong>Today:</strong> Over <strong>1 billion</strong> QR code scans happen daily worldwide!</p>

                <h3>Why They're Revolutionary</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>Open Standard:</strong> Denso Wave made QR codes patent-free, allowing anyone to create and use them</li>
                    <li><strong>Universal Access:</strong> Anyone with a smartphone can scan them - no special equipment needed</li>
                    <li><strong>Bridge Physical & Digital:</strong> Connect real-world objects to online content instantly</li>
                    <li><strong>Resilient:</strong> Work even when partially damaged or dirty</li>
                    <li><strong>Fast:</strong> Can be read in as little as 0.03 seconds</li>
                    <li><strong>Versatile:</strong> Can store URLs, contact info, WiFi credentials, location data, and more</li>
                </ul>

                <h3>Common Uses Today</h3>
                <ul>
                    <li><strong>Mobile Payments</strong> - PayPal, Venmo, Cash App, Apple Pay</li>
                    <li><strong>Tickets & Boarding Passes</strong> - Airlines, concerts, movies, sports</li>
                    <li><strong>Restaurant Menus</strong> - Contactless ordering and payment</li>
                    <li><strong>Package Tracking</strong> - FedEx, UPS, Amazon deliveries</li>
                    <li><strong>Marketing</strong> - Posters, billboards, product packaging</li>
                    <li><strong>Healthcare</strong> - Patient wristbands, medication tracking</li>
                    <li><strong>Education</strong> - Homework links, attendance, resource sharing</li>
                    <li><strong>Retail</strong> - Product information, loyalty programs, coupons</li>
                    <li><strong>Museums</strong> - Exhibit information and audio tours</li>
                    <li><strong>WiFi Sharing</strong> - Instant network access without typing passwords</li>
                </ul>

                <div style="background: rgba(236, 72, 153, 0.1); padding: 15px; border-left: 3px solid #ec4899; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #f9a8d4;"><strong>Fun Fact:</strong></p>
                    <p style="margin: 8px 0 0;">The three large squares in the corners of QR codes are called "position markers" or "finder patterns." They allow scanners to detect the code and determine its orientation instantly, which is why QR codes work when held at any angle - even upside down!</p>
                </div>
            `
        },
        'error-correction': {
            title: 'Error Correction Levels',
            content: `
                <div style="background: rgba(147, 51, 234, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 3px solid #a855f7;">
                    <h3 style="margin-top: 0; color: #a855f7;">What is Error Correction?</h3>
                    <p style="margin-bottom: 0;">Error correction uses redundant data so QR codes can still work even if parts are damaged, dirty, obscured, or have logos overlaid. The QR code essentially stores backup copies of its data.</p>
                </div>

                <h3 style="margin-top: 25px;">The Four Levels Compared</h3>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                    <div style="padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px; border-left: 3px solid #10b981;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <strong style="color: #10b981; font-size: 1.1em;">Level L (Low)</strong>
                            <span style="background: #10b981; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">7%</span>
                        </div>
                        <p style="margin: 0 0 8px 0; color: #b8b8b8; font-size: 0.9em;">Can recover if 7% is damaged</p>
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 8px; border-radius: 4px; font-size: 0.85em;">
                            <div style="color: #10b981; font-weight: bold; margin-bottom: 4px;">Benefits:</div>
                            <div style="color: #b8b8b8;">Smallest, simplest code</div>
                            <div style="color: #b8b8b8;">Scans fastest</div>
                            <div style="color: #b8b8b8;">Best for digital displays</div>
                        </div>
                    </div>

                    <div style="padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px; border-left: 3px solid #3b82f6;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <strong style="color: #3b82f6; font-size: 1.1em;">Level M (Medium)</strong>
                            <span style="background: #3b82f6; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">15%</span>
                        </div>
                        <p style="margin: 0 0 8px 0; color: #b8b8b8; font-size: 0.9em;">Can recover if 15% is damaged</p>
                        <div style="background: rgba(59, 130, 246, 0.1); padding: 8px; border-radius: 4px; font-size: 0.85em;">
                            <div style="color: #3b82f6; font-weight: bold; margin-bottom: 4px;">Benefits:</div>
                            <div style="color: #b8b8b8;">Good balance of size/durability</div>
                            <div style="color: #b8b8b8;"><strong>Recommended default</strong></div>
                            <div style="color: #b8b8b8;">Works in most conditions</div>
                        </div>
                    </div>

                    <div style="padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px; border-left: 3px solid #f59e0b;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <strong style="color: #f59e0b; font-size: 1.1em;">Level Q (Quartile)</strong>
                            <span style="background: #f59e0b; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">25%</span>
                        </div>
                        <p style="margin: 0 0 8px 0; color: #b8b8b8; font-size: 0.9em;">Can recover if 25% is damaged</p>
                        <div style="background: rgba(245, 158, 11, 0.1); padding: 8px; border-radius: 4px; font-size: 0.85em;">
                            <div style="color: #f59e0b; font-weight: bold; margin-bottom: 4px;">Benefits:</div>
                            <div style="color: #b8b8b8;">Can add small logos/branding</div>
                            <div style="color: #b8b8b8;">Good for outdoor use</div>
                            <div style="color: #b8b8b8;">Handles wear & tear well</div>
                        </div>
                    </div>

                    <div style="padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px; border-left: 3px solid #ef4444;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <strong style="color: #ef4444; font-size: 1.1em;">Level H (High)</strong>
                            <span style="background: #ef4444; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">30%</span>
                        </div>
                        <p style="margin: 0 0 8px 0; color: #b8b8b8; font-size: 0.9em;">Can recover if 30% is damaged</p>
                        <div style="background: rgba(239, 68, 68, 0.1); padding: 8px; border-radius: 4px; font-size: 0.85em;">
                            <div style="color: #ef4444; font-weight: bold; margin-bottom: 4px;">Benefits:</div>
                            <div style="color: #b8b8b8;">Maximum durability</div>
                            <div style="color: #b8b8b8;">Large logo overlay possible</div>
                            <div style="color: #b8b8b8;">Best for harsh conditions</div>
                        </div>
                    </div>
                </div>

                <div style="background: rgba(239, 68, 68, 0.1); padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #ef4444;">
                    <h3 style="margin-top: 0; color: #ef4444;">Important Trade-off</h3>
                    <p style="margin-bottom: 12px;"><strong>Higher error correction = Denser, larger QR code</strong></p>
                    <p style="margin: 12px 0 0 0; font-size: 0.9em; color: #ccc;">More error correction requires storing more redundant data, making codes more complex and harder for low-quality scanners to read.</p>
                </div>

                <h3 style="margin-top: 25px;">Real-World Use Cases</h3>
                <div style="display: grid; gap: 12px;">
                    <div style="padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border-left: 3px solid #10b981;">
                        <strong style="color: #10b981;">Digital Displays (Level L)</strong>
                        <p style="margin: 8px 0 0 0; color: #b8b8b8; font-size: 0.9em;">Websites, emails, presentations, digital menus. Always pristine and well-lit.</p>
                    </div>

                    <div style="padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 3px solid #3b82f6;">
                        <strong style="color: #3b82f6;">Printed Materials (Level M)</strong>
                        <p style="margin: 8px 0 0 0; color: #b8b8b8; font-size: 0.9em;">Flyers, business cards, indoor posters, product packaging. May get slightly worn but generally protected.</p>
                    </div>

                    <div style="padding: 12px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border-left: 3px solid #f59e0b;">
                        <strong style="color: #f59e0b;">Outdoor/Branded (Level Q)</strong>
                        <p style="margin: 8px 0 0 0; color: #b8b8b8; font-size: 0.9em;">Storefront windows, outdoor posters, stickers, codes with company logos overlaid. Exposed to weather and handling.</p>
                    </div>

                    <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 3px solid #ef4444;">
                        <strong style="color: #ef4444;">Harsh Environments (Level H)</strong>
                        <p style="margin: 8px 0 0 0; color: #b8b8b8; font-size: 0.9em;">Construction sites, warehouse labels, outdoor equipment tags, heavily branded marketing materials with large logo coverage. Maximum damage resistance needed.</p>
                    </div>
                </div>

                <div style="margin-top: 20px; padding: 12px; background: rgba(147, 51, 234, 0.1); border-radius: 8px;">
                    <p style="margin: 0; font-size: 0.9em; color: #ccc;"><strong>Pro Tip:</strong> When in doubt, stick with Level M (Medium). It provides excellent durability for most use cases without unnecessarily increasing code complexity.</p>
                </div>
            `
        },
        'customization': {
            title: 'Color & Customization',
            content: `
                <h3>Color Requirements</h3>
                <p>For QR codes to scan reliably, there must be <strong>high contrast</strong> between the foreground (dark) and background (light) colors.</p>

                <h3>Best Practices</h3>
                <ul>
                    <li><strong>High contrast is essential</strong> - Dark on light works best</li>
                    <li><strong>Black on white</strong> - Most reliable combination</li>
                    <li><strong>Dark blue on white</strong> - Good for branding</li>
                    <li><strong>Avoid low contrast</strong> - Yellow on white won't scan</li>
                    <li><strong>Don't reverse</strong> - Light on dark can have scanning issues</li>
                </ul>

                <h3>Why Contrast Matters</h3>
                <p>QR code scanners use your camera to detect the pattern. If the contrast is too low, the scanner can't distinguish between the "on" and "off" modules (squares).</p>

                <h3>Testing Your Colors</h3>
                <p>After customizing colors, always test your QR code with multiple devices and scanner apps to ensure it works reliably!</p>

                <div style="margin-top: 20px; padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;">
                    <strong style="color: #ef4444; display: block; margin-bottom: 8px;">Safety Reminder</strong>
                    <p style="margin: 0; color: #fca5a5;">Never scan QR codes from unknown sources! They could link to malicious websites. Only scan codes from trusted sources.</p>
                </div>
            `
        },
        'anatomy': {
            title: 'QR Code Anatomy',
            content: `
                <h3>Key Components</h3>

                <h4>1. Finder Patterns (Corner Squares)</h4>
                <p>The three large squares in the corners help scanners locate and orient the QR code, even at angles.</p>

                <h4>2. Timing Patterns</h4>
                <p>Alternating black and white modules between the finder patterns help the scanner determine the size of each module.</p>

                <h4>3. Alignment Patterns</h4>
                <p>Smaller squares (in larger QR codes) that help correct for distortion and perspective.</p>

                <h4>4. Data Modules</h4>
                <p>The actual encoded information - your URL, text, or other data.</p>

                <h4>5. Error Correction Codes</h4>
                <p>Redundant data that allows reconstruction if part of the code is damaged.</p>

                <h4>6. Quiet Zone</h4>
                <p>The white border around the QR code. This empty space is required - never cut it off!</p>

                <h3>Fun Facts</h3>
                <ul>
                    <li>QR codes can store up to 4,296 alphanumeric characters</li>
                    <li>They can be scanned from any angle (360 degree rotation)</li>
                    <li>They can be read in milliseconds</li>
                    <li>"QR Code" is a registered trademark of Denso Wave</li>
                </ul>
            `
        },
        'how-qr-works': {
            title: 'How QR Codes Actually Work',
            content: `
                <h3>From Pattern to Information</h3>
                <p>Ever wondered how your phone turns a pattern of black and white squares into a website? Let's break it down step-by-step!</p>

                <h3>Step 1: Encoding (Creating the QR Code)</h3>
                <div style="background: rgba(147, 51, 234, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="margin-top: 0;">Data Conversion</h4>
                    <p>When you create a QR code, your text/URL goes through these transformations:</p>
                    <ol style="line-height: 1.8;">
                        <li><strong>Character Encoding:</strong> Text converted to numbers
                            <br><span style="font-size: 0.9em; opacity: 0.8;">Example: "A" becomes 10, "B" becomes 11, etc.</span>
                        </li>
                        <li><strong>Binary Conversion:</strong> Numbers become 1s and 0s
                            <br><span style="font-size: 0.9em; opacity: 0.8;">Example: 10 becomes 00001010</span>
                        </li>
                        <li><strong>Error Correction Added:</strong> Extra data for damage recovery
                            <br><span style="font-size: 0.9em; opacity: 0.8;">Uses Reed-Solomon algorithm (same as CDs/DVDs)</span>
                        </li>
                        <li><strong>Pattern Generation:</strong> Binary becomes black (1) and white (0) squares
                            <br><span style="font-size: 0.9em; opacity: 0.8;">1 = black module, 0 = white module</span>
                        </li>
                    </ol>
                </div>

                <h3>Step 2: Scanning (Reading the QR Code)</h3>
                <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="margin-top: 0;">The Camera's Job</h4>
                    <ol style="line-height: 1.8;">
                        <li><strong>Image Capture:</strong> Camera takes a picture of the QR code</li>
                        <li><strong>Detection:</strong> Software looks for the three corner squares (finder patterns)</li>
                        <li><strong>Orientation:</strong> Determines which way the code is rotated</li>
                        <li><strong>Perspective Correction:</strong> Adjusts for angles and distortion</li>
                        <li><strong>Module Reading:</strong> Identifies each black and white square</li>
                    </ol>
                </div>

                <h3>Step 3: Decoding (Understanding the Data)</h3>
                <div style="background: rgba(236, 72, 153, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="margin-top: 0;">Pattern to Information</h4>
                    <ol style="line-height: 1.8;">
                        <li><strong>Binary Extraction:</strong> Black/white pattern to 1s and 0s</li>
                        <li><strong>Error Correction:</strong> Fixes any damaged or unclear bits</li>
                        <li><strong>Data Type Detection:</strong> Identifies if it's a URL, text, phone number, etc.</li>
                        <li><strong>Character Conversion:</strong> Binary to numbers to characters</li>
                        <li><strong>Final Output:</strong> Your original URL or text appears!</li>
                    </ol>
                </div>

                <h3>The Math Behind It</h3>
                <h4>Reed-Solomon Error Correction</h4>
                <p>QR codes use the same mathematical algorithm that makes CDs and DVDs work even when scratched!</p>
                <ul>
                    <li><strong>Polynomial Mathematics:</strong> Data treated as polynomial equations</li>
                    <li><strong>Redundancy:</strong> Extra data added based on error correction level</li>
                    <li><strong>Recovery:</strong> Can reconstruct missing data using surrounding information</li>
                </ul>

                <div style="background: rgba(59, 130, 246, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 0;"><strong>Think of it like this:</strong></p>
                    <p style="margin: 8px 0 0;">If I say "The cat sat on the ___", you can guess the missing word is "mat" even though you didn't see it. That's essentially what error correction does - it uses patterns in the data to fill in gaps!</p>
                </div>

                <h3>Version and Capacity</h3>
                <p>QR codes come in 40 different sizes (called "versions"):</p>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr style="background: rgba(147, 51, 234, 0.2);">
                        <th style="padding: 10px; text-align: left; border: 1px solid rgba(255,255,255,0.1);">Version</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid rgba(255,255,255,0.1);">Size</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid rgba(255,255,255,0.1);">Max Characters (Numeric)</th>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Version 1</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">21x21 modules</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">41 numbers</td>
                    </tr>
                    <tr style="background: rgba(255,255,255,0.02);">
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Version 10</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">57x57 modules</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">652 numbers</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Version 20</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">97x97 modules</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">1,852 numbers</td>
                    </tr>
                    <tr style="background: rgba(255,255,255,0.02);">
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">Version 40</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">177x177 modules</td>
                        <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.1);">7,089 numbers</td>
                    </tr>
                </table>

                <h3>Why They're So Fast</h3>
                <ul>
                    <li><strong>Parallel Processing:</strong> Phones scan the entire code at once, not line by line</li>
                    <li><strong>Instant Orientation:</strong> Corner squares let scanner know rotation immediately</li>
                    <li><strong>Optimized Algorithms:</strong> Decoding software highly optimized for mobile processors</li>
                    <li><strong>No Server Needed:</strong> All decoding happens on your device</li>
                </ul>

                <h3>Security Considerations</h3>
                <div style="background: rgba(239, 68, 68, 0.1); padding: 15px; border-left: 3px solid #ef4444; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 0;"><strong>Important to Know:</strong></p>
                    <ul style="margin: 8px 0 0; padding-left: 24px;">
                        <li>QR codes themselves aren't dangerous - they're just data</li>
                        <li>The danger is <em>where they point to</em></li>
                        <li>Modern phones preview the URL before opening</li>
                        <li>Always check the URL before visiting</li>
                        <li>Don't scan QR codes from untrusted sources</li>
                    </ul>
                </div>

                <h3>Cool Technical Facts</h3>
                <ul>
                    <li>The quiet zone (white border) must be at least 4 modules wide</li>
                    <li>QR codes can be scanned even when rotated, flipped, or inverted</li>
                    <li>The positioning patterns help correct for perspective distortion</li>
                    <li>Each version has a specific "mask pattern" to optimize scanning</li>
                    <li>QR codes use "modules" (squares) as their basic unit</li>
                    <li>Alignment patterns (small squares) appear in larger QR codes to prevent warping</li>
                </ul>

                <div style="background: rgba(168, 85, 247, 0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #c084fc;"><strong>Try This!</strong></p>
                    <p style="margin: 8px 0 0;">Next time you scan a QR code, notice how your phone works: it finds the code instantly (even at an angle), shows you where it points, and lets you decide whether to open it. All of this happens in fractions of a second thanks to clever mathematics and optimized software!</p>
                </div>
            `
        },
        'best-practices': {
            title: 'Best Practices',
            content: `
                <h3>URL Management</h3>
                <ul>
                    <li><strong>Use short URLs</strong> - Shorter URLs create simpler, easier-to-scan codes</li>
                    <li><strong>Test before printing</strong> - Always verify the QR works</li>
                    <li><strong>Keep URLs stable</strong> - Make sure your destination URL won't change</li>
                </ul>

                <h3>Size Guidelines</h3>
                <ul>
                    <li><strong>Minimum print size:</strong> 2cm x 2cm (0.8" x 0.8")</li>
                    <li><strong>Recommended:</strong> 3-4cm for business cards, 10cm+ for posters</li>
                    <li><strong>Rule of thumb:</strong> Scanning distance / 10 = minimum size</li>
                </ul>

                <h3>Placement Tips</h3>
                <ul>
                    <li><strong>Eye level</strong> - Easy to scan without bending</li>
                    <li><strong>Avoid glare</strong> - No glossy surfaces or direct light</li>
                    <li><strong>Keep it flat</strong> - Curves and folds reduce scannability</li>
                    <li><strong>Include instructions</strong> - "Scan for menu" helps users</li>
                </ul>

                <h3>Security Considerations</h3>
                <div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; margin-bottom: 15px;">
                    <strong style="color: #ef4444; display: block; margin-bottom: 10px;">Important Security Tips</strong>
                    <ul style="margin: 0; padding-left: 24px; color: #fca5a5;">
                        <li style="margin-bottom: 8px;">Never scan QR codes from unknown or suspicious sources</li>
                        <li style="margin-bottom: 8px;">Be cautious of QR codes in public places (they could be replaced with malicious ones)</li>
                        <li style="margin-bottom: 8px;">Preview the URL before visiting (many scanner apps show the URL first)</li>
                        <li style="margin-bottom: 0;">Watch out for QR codes that lead to unexpected websites</li>
                    </ul>
                </div>

                <h3>Testing Checklist</h3>
                <ul>
                    <li>Test on multiple devices (iPhone, Android, tablets)</li>
                    <li>Try different scanner apps</li>
                    <li>Test in different lighting conditions</li>
                    <li>Verify the URL is correct</li>
                    <li>Check from different distances</li>
                </ul>
            `
        }
    };

    return content[topic] || { title: 'Help', content: '<p>Help content not found.</p>' };
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showToast(message, type) {
    type = type || 'success';
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Help menu toggle functions
function toggleHelpMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('help-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function closeHelpMenu() {
    document.getElementById('help-menu').style.display = 'none';
}

// Close help menu when clicking outside
document.addEventListener('click', function(event) {
    var helpMenu = document.getElementById('help-menu');
    var helpDropdown = document.querySelector('.help-dropdown');

    if (helpMenu && helpDropdown && !helpDropdown.contains(event.target)) {
        helpMenu.style.display = 'none';
    }
});

// ============================================
// EDUCATIONAL MODE FUNCTIONS
// ============================================

let educationalModeActive = false;
let currentEduTab = 'anatomy';
let damageCanvas = null;
let damagedPixels = [];
let totalPixels = 0;
let damageBrushSize = 3; // 1=Tiny, 2=Small, 3=Medium, 4=Large, 5=Huge

function toggleEducationalMode() {
    educationalModeActive = !educationalModeActive;
    const panel = document.getElementById('educational-panel');
    const button = document.getElementById('edu-mode-btn');

    if (educationalModeActive) {
        panel.style.display = 'block';
        button.classList.add('active');
        button.textContent = 'Learn Mode (Active)';

        // Initialize the current tab
        initializeEduTab(currentEduTab);

        // Always show target URL QR code
        updateQRCode();
    } else {
        panel.style.display = 'none';
        button.classList.remove('active');
        button.textContent = 'Learn Mode';

        // Cleanup
        if (damageCanvas) {
            damageCanvas.remove();
            damageCanvas = null;
        }
    }
}

function switchEduTab(tabName) {
    currentEduTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.edu-tab').forEach(function(tab) {
        tab.classList.remove('active');
    });
    document.querySelector('.edu-tab[data-tab="' + tabName + '"]').classList.add('active');

    // Update tab content
    document.querySelectorAll('.edu-tab-content').forEach(function(content) {
        content.classList.remove('active');
    });
    document.getElementById('edu-' + tabName).classList.add('active');

    // Initialize the tab
    initializeEduTab(tabName);
}

function initializeEduTab(tabName) {
    if (tabName === 'anatomy') {
        initializeAnatomyMode();
    } else if (tabName === 'damage') {
        initializeDamageMode();
    } else if (tabName === 'data') {
        initializeDataMode();
    }
}

// Anatomy Tab Functions
function initializeAnatomyMode() {
    var info = document.getElementById('anatomy-info');
    info.innerHTML = '\
        <div style="padding: 15px; background: rgba(147, 51, 234, 0.1); border-radius: 8px; border-left: 3px solid #a855f7;">\
            <h4 style="color: #a855f7; margin-top: 0;">QR Code Structure</h4>\
            <div style="margin-bottom: 12px;">\
                <strong style="color: #ef4444;">Position Markers (3 corners):</strong>\
                <p style="margin: 5px 0 0 0; color: #ccc; font-size: 0.9em;">Help scanners detect the QR code and determine its orientation. That\'s why QR codes work upside down!</p>\
            </div>\
            <div style="margin-bottom: 12px;">\
                <strong style="color: #3b82f6;">Timing Patterns:</strong>\
                <p style="margin: 5px 0 0 0; color: #ccc; font-size: 0.9em;">Alternating black/white modules that help the scanner determine the size and spacing of the code\'s grid.</p>\
            </div>\
            <div style="margin-bottom: 12px;">\
                <strong style="color: #10b981;">Data & Error Correction:</strong>\
                <p style="margin: 5px 0 0 0; color: #ccc; font-size: 0.9em;">The bulk of the QR code contains your encoded URL plus redundant error correction data that allows damaged codes to still work.</p>\
            </div>\
            <div>\
                <strong style="color: #f59e0b;">Format Information:</strong>\
                <p style="margin: 5px 0 0 0; color: #ccc; font-size: 0.9em;">Small sections that tell the scanner which error correction level is being used and which mask pattern was applied.</p>\
            </div>\
        </div>\
    ';
}

// Damage Test Functions
function initializeDamageMode() {
    damagedPixels = [];
    updateDamageDisplay();
    updateErrorCorrectionInfo();

    // Wait a moment for the QR code to be ready
    setTimeout(function() {
        createDamageCanvas();
    }, 200);
}

function createDamageCanvas() {
    // Remove existing canvas
    if (damageCanvas) {
        damageCanvas.remove();
    }

    // Find the visible QR element (could be canvas or img)
    var container = document.getElementById('qr-preview');

    var qrElement = container.querySelector('img');
    if (!qrElement) {
        qrElement = container.querySelector('canvas');
    }

    if (!qrElement) {
        console.error('No QR code element found!');
        return;
    }

    // Get the actual displayed size
    var rect = qrElement.getBoundingClientRect();

    // Create overlay canvas for damage
    damageCanvas = document.createElement('canvas');
    damageCanvas.className = 'qr-damage-canvas';

    // Set canvas internal resolution to match the displayed size
    damageCanvas.width = rect.width;
    damageCanvas.height = rect.height;

    // Set display size
    damageCanvas.style.width = rect.width + 'px';
    damageCanvas.style.height = rect.height + 'px';
    damageCanvas.style.position = 'absolute';
    damageCanvas.style.top = qrElement.offsetTop + 'px';
    damageCanvas.style.left = qrElement.offsetLeft + 'px';
    damageCanvas.style.zIndex = '10';
    damageCanvas.style.cursor = 'crosshair';

    container.appendChild(damageCanvas);

    totalPixels = damageCanvas.width * damageCanvas.height;

    // Add click handler for damage
    damageCanvas.addEventListener('click', handleDamageClick);

    // Add mousemove handler to show brush preview
    damageCanvas.addEventListener('mousemove', showBrushPreview);
    damageCanvas.addEventListener('mouseleave', clearBrushPreview);
}

function showBrushPreview(e) {
    var rect = damageCanvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - rect.left) / rect.width * damageCanvas.width);
    var y = Math.floor((e.clientY - rect.top) / rect.height * damageCanvas.height);

    var brushPercentages = [0.02, 0.05, 0.10, 0.20, 0.35];
    var damageRadius = Math.floor(damageCanvas.width * brushPercentages[damageBrushSize - 1]);

    // Redraw damage first
    drawDamage();

    // Draw brush preview circle with thicker line
    var ctx = damageCanvas.getContext('2d');
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, damageRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Also draw a small crosshair at the center
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
}

function clearBrushPreview() {
    drawDamage(); // Just redraw without the preview
}

function handleDamageClick(e) {
    var rect = damageCanvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - rect.left) / rect.width * damageCanvas.width);
    var y = Math.floor((e.clientY - rect.top) / rect.height * damageCanvas.height);

    // Store as "x,y,size" key
    var key = x + ',' + y + ',' + damageBrushSize;
    if (damagedPixels.indexOf(key) === -1) {
        damagedPixels.push(key);
    }

    drawDamage();
    updateDamageDisplay();
}

function drawDamage() {
    var ctx = damageCanvas.getContext('2d');
    ctx.clearRect(0, 0, damageCanvas.width, damageCanvas.height);

    // Draw damage spots as circles with varying sizes
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    damagedPixels.forEach(function(key) {
        var parts = key.split(',');
        var x = parseInt(parts[0]);
        var y = parseInt(parts[1]);
        var size = parseInt(parts[2]) || 3;

        var radiusSizes = [0.5, 0.6, 0.75, 1, 1.5];
        var radius = radiusSizes[size - 1] || 10;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function updateDamageDisplay() {
    // Calculate actual damage by adding up the area of each damage spot
    var totalDamageArea = 0;
    var radiusSizes = [0.5, 0.6, 0.75, 1, 1.5];

    damagedPixels.forEach(function(key) {
        var parts = key.split(',');
        var size = parseInt(parts[2]) || 3;
        var radius = radiusSizes[size - 1] || 10;
        var area = Math.PI * radius * radius;
        totalDamageArea += area;
    });

    var canvasArea = totalPixels;
    var percentage = canvasArea > 0 ? ((totalDamageArea / canvasArea) * 100).toFixed(1) : 0;
    document.getElementById('damage-percentage').textContent = percentage + '%';

    // Update status based on error correction level
    var ecLevels = { L: 7, M: 15, Q: 25, H: 30 };
    var currentLevel = qrSettings.errorCorrection || 'M';
    var threshold = ecLevels[currentLevel];

    var likelyScannable = threshold * 0.2;
    var maybeScannable = threshold * 0.35;

    var statusEl = document.getElementById('damage-status');
    if (parseFloat(percentage) <= likelyScannable) {
        statusEl.textContent = 'Likely Scannable';
        statusEl.style.color = '#10b981';
    } else if (parseFloat(percentage) <= maybeScannable) {
        statusEl.textContent = 'May Scan (depends on damage location)';
        statusEl.style.color = '#f59e0b';
    } else {
        statusEl.textContent = 'Probably Unscannable';
        statusEl.style.color = '#ef4444';
    }
}

function resetDamage() {
    damagedPixels = [];
    if (damageCanvas) {
        var ctx = damageCanvas.getContext('2d');
        ctx.clearRect(0, 0, damageCanvas.width, damageCanvas.height);
    }
    updateDamageDisplay();
}

function randomDamage(percentageToAdd) {
    // Calculate how much area we need to add to reach the target percentage
    var targetArea = (percentageToAdd / 100) * totalPixels;

    // Use current brush size for random damage
    var radiusSizes = [0.5, 0.6, 0.75, 1, 1.5];
    var radius = radiusSizes[damageBrushSize - 1];
    var areaPerSpot = Math.PI * radius * radius;

    // Calculate how many spots we need to add
    var spotsToAdd = Math.ceil(targetArea / areaPerSpot);

    for (var i = 0; i < spotsToAdd; i++) {
        var x = Math.floor(Math.random() * damageCanvas.width);
        var y = Math.floor(Math.random() * damageCanvas.height);
        var key = x + ',' + y + ',' + damageBrushSize;
        if (damagedPixels.indexOf(key) === -1) {
            damagedPixels.push(key);
        }
    }

    drawDamage();
    updateDamageDisplay();
}

function updateErrorCorrectionInfo() {
    var ecLevels = {
        L: { name: 'L (Low)', percentage: '7%' },
        M: { name: 'M (Medium)', percentage: '15%' },
        Q: { name: 'Q (Quartile)', percentage: '25%' },
        H: { name: 'H (High)', percentage: '30%' }
    };

    var currentLevel = qrSettings.errorCorrection || 'M';
    var info = ecLevels[currentLevel];

    document.getElementById('current-ec-level').textContent = info.name;
    document.getElementById('ec-percentage').textContent = info.percentage;
}

function updateBrushSize(value) {
    damageBrushSize = parseInt(value);
    var sizeNames = ['Tiny', 'Small', 'Medium', 'Large', 'Huge'];
    var sizeName = sizeNames[damageBrushSize - 1];

    // Calculate estimated clicks for 25% damage
    var radiusSizes = [0.5, 0.6, 0.75, 1, 1.5];
    var radius = radiusSizes[damageBrushSize - 1];
    var area = Math.PI * radius * radius;
    var clicksFor25Percent = totalPixels > 0 ? Math.ceil((totalPixels * 0.25) / area) : 0;

    document.getElementById('brush-size-value').textContent = sizeName + ' (~' + clicksFor25Percent + ' clicks for 25%)';
}

// Data Encoding Functions
function initializeDataMode() {
    updateDataVisualization();
}

function updateDataVisualization() {
    var url = qrSettings.targetUrl || 'https://example.com';

    // Update URL display
    document.getElementById('original-url').textContent = url;
    document.getElementById('url-char-count').textContent = url.length;

    // Convert to binary (simplified representation)
    var binary = urlToBinary(url);
    document.getElementById('binary-display').textContent = binary;
    document.getElementById('binary-bits').textContent = (url.length * 8);

    // Update error correction bar
    var ecPercentages = { L: 7, M: 15, Q: 25, H: 30 };
    var currentLevel = qrSettings.errorCorrection || 'M';
    var ecPercent = ecPercentages[currentLevel];
    var dataPercent = 100 - ecPercent;

    document.getElementById('data-actual-bar').style.width = dataPercent + '%';
    document.getElementById('data-ec-bar').style.width = ecPercent + '%';

    // Estimate total capacity (simplified)
    var estimatedModules = Math.ceil(url.length * 10 * (1 + ecPercent / 100));
    document.getElementById('total-capacity').textContent = estimatedModules;
}

function urlToBinary(text) {
    // Convert first 50 characters to binary for display
    var maxChars = Math.min(50, text.length);
    var binary = '';

    for (var i = 0; i < maxChars; i++) {
        var charCode = text.charCodeAt(i);
        binary += charCode.toString(2).padStart(8, '0') + ' ';

        // Add line breaks for readability
        if ((i + 1) % 6 === 0) {
            binary += '\n';
        }
    }

    if (text.length > maxChars) {
        binary += '\n... (truncated)';
    }

    return binary.trim();
}

// ============================================
// Monkey-patch: update educational panels when QR changes
// ============================================
var originalUpdateQRCode = updateQRCode;
updateQRCode = function() {
    originalUpdateQRCode();

    if (educationalModeActive && currentEduTab === 'data') {
        setTimeout(updateDataVisualization, 100);
    }

    if (educationalModeActive && currentEduTab === 'damage') {
        setTimeout(function() {
            createDamageCanvas();
            updateErrorCorrectionInfo();
        }, 100);
    }
};

// ============================================
// PLATFORM INTEGRATION
// ============================================

// Platform-compatible serialize
window.serializeProjectData = function() {
    return JSON.stringify({
        qr_version: '1.0',
        target_url: qrSettings.targetUrl,
        settings: {
            size: qrSettings.size,
            error_correction: qrSettings.errorCorrection,
            foreground_color: qrSettings.fgColor,
            background_color: qrSettings.bgColor
        }
    });
};

// Platform-compatible load
window.loadProjectData = function(data) {
    if (typeof data === 'string') {
        data = JSON.parse(data);
    }
    _loadProjectSettings(data);
};
