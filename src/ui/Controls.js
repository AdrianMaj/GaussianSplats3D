export class Controls {
    /**
     * This component shows the WASDQE controls with highlighting of pressed keys
     * @param {HTMLElement} container - The container to append the controls to 
     * @param {boolean} hide - Whether to hide the controls or not
     */
    constructor(container, hide) {
        this.container = container || document.body;
        this.keysPressed = {};
        
        // Check if device is mobile or touch-enabled
        this.isMobileOrTouch = this.detectMobileOrTouch();
        
        // Create controls container
        this.controlsElement = document.createElement('div');
        this.controlsElement.className = 'controls-panel';
        this.controlsElement.style.display = hide || this.isMobileOrTouch ? 'none' : 'flex';
        
        // Create the key layout
        this.controlsElement.innerHTML = `
            <div class="controls-row">
                <div class="key-container">
                    <div class="key" data-key="KeyQ">Q</div>
                </div>
                <div class="key-container">
                    <div class="key" data-key="KeyW">W</div>
                </div>
                <div class="key-container">
                    <div class="key" data-key="KeyE">E</div>
                </div>
            </div>
            <div class="controls-row">
                <div class="key-container">
                    <div class="key" data-key="KeyA">A</div>
                </div>
                <div class="key-container">
                    <div class="key" data-key="KeyS">S</div>
                </div>
                <div class="key-container">
                    <div class="key" data-key="KeyD">D</div>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.innerHTML = `
            .controls-panel {
                position: absolute;
                display: flex;
                flex-direction: column;
                gap: 5px;
                bottom: 20px;
                left: 20px;
                z-index: 1000;
                background-color: rgba(0, 0, 0, 0.5);
                padding: 10px;
                border-radius: 8px;
            }
            
            .controls-row {
                display: flex;
                gap: 5px;
            }
            
            .key-container {
                width: 40px;
                height: 40px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .key {
                width: 36px;
                height: 36px;
                background-color: rgba(255, 255, 255, 0.8);
                color: #333;
                display: flex;
                justify-content: center;
                align-items: center;
                border-radius: 4px;
                font-family: Arial, sans-serif;
                font-weight: bold;
                user-select: none;
                cursor: default;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            
            .key.pressed {
                background-color: #C27BFF;
                transform: translateY(2px);
                box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
            }
        `;
        
        this.controlsElement.appendChild(style);
        this.container.appendChild(this.controlsElement);
        
        // Set up event listeners
        this.setupKeyListeners();
    }
    
    /**
     * Set up keyboard event listeners to highlight pressed keys
     */
    setupKeyListeners() {
        // Don't set up listeners if on mobile/touch
        if (this.isMobileOrTouch) return;
        
        // Keydown event - highlight key
        document.addEventListener('keydown', (event) => {
            this.keysPressed[event.code] = true;
            this.updateKeyHighlights();
        });
        
        // Keyup event - remove highlight
        document.addEventListener('keyup', (event) => {
            this.keysPressed[event.code] = false;
            this.updateKeyHighlights();
        });
    }
    
    /**
     * Update the visual highlighting of keys based on pressed state
     */
    updateKeyHighlights() {
        // Get all key elements
        const keyElements = this.controlsElement.querySelectorAll('.key');
        
        // Update each key's appearance
        keyElements.forEach(key => {
            const keyCode = key.getAttribute('data-key');
            if (this.keysPressed[keyCode]) {
                key.classList.add('pressed');
            } else {
                key.classList.remove('pressed');
            }
        });
    }
    
    /**
     * Show the controls (only if not on mobile/touch device)
     */
    show() {
        if (!this.isMobileOrTouch) {
            this.controlsElement.style.display = 'flex';
        }
    }
    
    /**
     * Hide the controls
     */
    hide() {
        this.controlsElement.style.display = 'none';
    }
    
    /**
     * Remove the component and clean up event listeners
     */
    /**
     * Detect if device is a mobile device (phone/tablet)
     * @returns {boolean} True if mobile device
     */
    detectMobileOrTouch() {
        // Check if it's a mobile device based on user agent
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Check screen size - typical cutoff for tablets is around 768px width
        const isSmallScreen = window.innerWidth <= 1024; 
        
        // Only hide on mobile devices, not just any touch-enabled device
        return isMobile && isSmallScreen;
    }
    
    /**
     * Remove the component and clean up event listeners
     */
    dispose() {
        document.removeEventListener('keydown', this.updateKeyHighlights);
        document.removeEventListener('keyup', this.updateKeyHighlights);
        if (this.controlsElement.parentNode) {
            this.container.removeChild(this.controlsElement);
        }
    }
}