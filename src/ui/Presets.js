export class Presets {
	/**
	 * This component shows buttons for preset views that users can click or press
	 * @param {HTMLElement} container - The container to append the controls to
	 * @param {Object} options - Configuration options
	 * @param {boolean} [options.hide=false] - Whether to hide the controls initially
	 * @param {[{label?: string; lookAt: number[]; position: number[];}]} [options.presets=[]] - Array of preset configurations
	 * @param {Function} [options.onPresetSelected] - Callback when preset is selected
	 * @param {Function} [options.onUpdate] - Callback when presets are updated (receives full presets array)
	 * @param {"admin" | "user"} [options.role="user"] - Role of the user (admin or user)
	 */
	constructor(container, options = {}) {
		this.container = container || document.body;
		this.keysPressed = {};
		this.presets = options.presets || [];
		this.onPresetSelected =
			options.onPresetSelected || ((preset) => console.log(`Preset ${preset.id} selected`));

		// Single update callback replacing individual callbacks
		this.onUpdate =
			options.onUpdate ||
			((presets) => {
				console.log("Fill the function to update presets: ", presets);
			});

		this.role = options.role || "user";
		this.editMode = false; // Start in view mode, not edit mode

		// Check if device is mobile
		this.isMobile = this.detectMobile();

		// Create controls container
		this.controlsElement = document.createElement("div");
		this.controlsElement.className = "preset-controls-panel";

		// Set initial display state
		this.controlsElement.style.display = options.hide ? "none" : "flex";

		// Limit to maximum 9 presets
		this.updatePresetIds();

		// Render preset buttons
		this.renderPresetButtons();

		// Add admin controls if user is admin
		if (this.role === "admin") {
			this.renderAdminControls();
		}

		this.container.appendChild(this.controlsElement);

		// Set up event listeners
		this.setupEventListeners();
	}

	/**
	 * Update preset IDs and key mappings
	 */
	updatePresetIds() {
		this.presets = this.presets.slice(0, 9).map((preset, index) => {
			return {
				...preset,
				id: index + 1,
				key: `Digit${index + 1}`,
				// Keep original label if it exists
				label: preset.label || "",
			};
		});
	}

	/**
	 * Render the preset buttons
	 */
	renderPresetButtons() {
		// Clear content first
		this.controlsElement.innerHTML = "";

		// If there are no presets and the user is not an admin, don't render anything
		if (this.presets.length === 0 && this.role !== "admin") {
			return;
		}

		// Create a container for preset buttons
		const presetsContainer = document.createElement("div");
		presetsContainer.className = "presets-container";

		// Create the preset buttons layout in a single row
		for (let i = 0; i < this.presets.length; i++) {
			const preset = this.presets[i];
			const buttonContainer = document.createElement("div");
			buttonContainer.className = "preset-button-container";

			const button = document.createElement("div");
			button.className = "preset-button";
			button.setAttribute("data-key", preset.key);
			button.setAttribute("data-preset-index", i);

			// Display number and label if it exists
			const positionNumber = i + 1;
			const displayText = preset.label
				? `<span class="preset-number">${positionNumber}</span><span class="preset-label">${preset.label}</span>`
				: positionNumber;

			button.innerHTML = displayText;

			// Add tooltips and edit mode styling for admin
			if (this.role === "admin" && this.editMode) {
				button.classList.add("edit-mode");
				button.setAttribute("data-tooltip", "Click to overwrite");

				// Add delete button (X) in the corner
				const deleteButton = document.createElement("div");
				deleteButton.className = "preset-delete-button";
				deleteButton.innerHTML = "×";
				deleteButton.addEventListener("click", (e) => {
					e.stopPropagation();
					this.handleDeletePreset(i);
				});

				button.appendChild(deleteButton);
			}

			buttonContainer.appendChild(button);
			presetsContainer.appendChild(buttonContainer);
		}

		// Add only one placeholder button (for the next position) if admin and in edit mode
		if (this.role === "admin" && this.editMode && this.presets.length < 9) {
			const buttonContainer = document.createElement("div");
			buttonContainer.className = "preset-button-container";

			const button = document.createElement("div");
			button.className = "preset-button preset-empty";
			button.setAttribute("data-preset-index", this.presets.length);
			button.innerHTML = "+";
			button.setAttribute("data-tooltip", "Add new preset");

			buttonContainer.appendChild(button);
			presetsContainer.appendChild(buttonContainer);
		}

		// Only add the container to the DOM if there's something to display
		if (presetsContainer.children.length > 0) {
			this.controlsElement.appendChild(presetsContainer);
		}

		// Only add styles if we're going to show something
		if (this.presets.length > 0 || this.role === "admin") {
			// Add styles
			const style = document.createElement("style");
			style.innerHTML = `
                .preset-controls-panel {
                    position: absolute;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 1000;
                    background-color: rgba(0, 0, 0, 0.5);
                    padding: 10px;
                    border-radius: 8px;
                    max-width: 90vw;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
                }
                
                @media (max-width: 768px) {
                    .preset-controls-panel {
                        max-width: 95vw;
                    }
                }
                
                .presets-container {
                    display: flex;
                    flex-direction: row;
                    flex-wrap: wrap;
                    gap: 5px;
                    justify-content: center;
                }
                
                .preset-button-container {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                }
                
                .preset-button {
                    width: 36px;
                    height: 36px;
                    background-color: rgba(255, 255, 255, 0.8);
                    color: #333;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 4px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-weight: bold;
                    user-select: none;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                    transition: all 0.1s ease;
                    position: relative;
                    font-size: 14px;
                    text-overflow: ellipsis;
                }
                
                .preset-number {
                    font-weight: bold;
                }
                
                .preset-label {
                    font-size: 10px;
                    margin-left: 1px;
                    opacity: 0.9;
                }
                
                .preset-button:hover {
                    background-color: rgba(255, 255, 255, 0.9);
                }
                
                .preset-button.pressed {
                    background-color: #C27BFF;
                    transform: translateY(2px);
                    box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
                }
                
                .preset-button.edit-mode {
                    background-color: rgba(194, 123, 255, 0.4); 
                    border: 2px dashed #fff;
                    color: #fff;
                }
                
                .preset-delete-button {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 16px;
                    height: 16px;
                    background-color: rgba(220, 53, 69, 0.9);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 12px;
                    line-height: 0;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                    z-index: 1;
                }
                
                .preset-delete-button:hover {
                    background-color: rgba(220, 53, 69, 1);
                    transform: scale(1.1);
                }
                
                .preset-empty {
                    background-color: rgba(150, 150, 150, 0.5);
                    color: white;
                    font-size: 18px;
                }

                .preset-empty:hover {
                    color: #333;
                }
                
                .preset-button[data-tooltip]:before {
                    content: attr(data-tooltip);
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    margin-bottom: 5px;
                    padding: 5px 8px;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: normal;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.2s;
                    pointer-events: none;
                    z-index: 10;
                }
                
                .preset-button[data-tooltip]:hover:before {
                    opacity: 1;
                }
                
                .admin-controls {
                    display: flex;
                    flex-direction: row;
                    gap: 5px;
                    justify-content: center;
                }
                
                .admin-button {
                    padding: 5px 10px;
                    background-color: rgba(80, 80, 80, 0.8);
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.1s ease;
                }
                
                .admin-button:hover {
                    background-color: rgba(100, 100, 100, 0.9);
                }
                
                .admin-button.active {
                    background-color: rgba(194, 123, 255, 0.8); /* Match the purple color */
                }
                
                .context-menu {
                    position: absolute;
                    background-color: #333;
                    border-radius: 4px;
                    padding: 5px 0;
                    z-index: 1001;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                }
                
                .context-menu-item {
                    padding: 8px 12px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                    white-space: nowrap;
                }
                
                .context-menu-item:hover {
                    background-color: #555;
                }
            `;

			this.controlsElement.appendChild(style);
		}
	}

	/**
	 * Render admin controls
	 */
	renderAdminControls() {
		// Only render admin controls if we're showing something
		if (this.presets.length === 0 && !this.editMode) {
			const adminControls = document.createElement("div");
			adminControls.className = "admin-controls";

			// Add a toggle button to switch between view and edit modes
			const editModeButton = document.createElement("div");
			editModeButton.className = "admin-button";
			editModeButton.innerHTML = "Enter Edit Mode";
			editModeButton.addEventListener("click", () => {
				this.editMode = true;
				this.renderPresetButtons(); // Re-render buttons with new mode
				this.renderAdminControls(); // Re-render admin controls to update button text
			});

			adminControls.appendChild(editModeButton);
			this.controlsElement.appendChild(adminControls);
			return;
		}

		const adminControls = document.createElement("div");
		adminControls.className = "admin-controls";

		// Add a toggle button to switch between view and edit modes
		const editModeButton = document.createElement("div");
		editModeButton.className = `admin-button ${this.editMode ? "active" : ""}`;
		editModeButton.innerHTML = this.editMode ? "Exit Edit Mode" : "Enter Edit Mode";
		editModeButton.addEventListener("click", () => {
			this.editMode = !this.editMode;
			this.renderPresetButtons(); // Re-render buttons with new mode
			this.renderAdminControls(); // Re-render admin controls to update button text
		});

		adminControls.appendChild(editModeButton);

		this.controlsElement.appendChild(adminControls);
	}

	/**
	 * Set up keyboard and click event listeners
	 */
	setupEventListeners() {
		// Don't set up keyboard listeners if on mobile
		if (!this.isMobile) {
			// Keydown event - highlight key and trigger preset
			document.addEventListener("keydown", this.handleKeyDown.bind(this));

			// Keyup event - remove highlight
			document.addEventListener("keyup", this.handleKeyUp.bind(this));
		}

		// Click event for buttons
		document.addEventListener("click", (event) => {
			// Remove any open context menu when clicking elsewhere
			if (this.contextMenu && !this.contextMenu.contains(event.target)) {
				this.removeContextMenu();
			}

			// Handle clicks on preset buttons
			if (
				event.target.classList.contains("preset-button") &&
				!event.target.classList.contains("preset-empty")
			) {
				this.handleButtonClick(event);
			} else if (
				event.target.closest(".preset-button") &&
				!event.target.classList.contains("preset-delete-button")
			) {
				// Handle clicks on child elements of the button (like number or label spans)
				const button = event.target.closest(".preset-button");
				if (button && !button.classList.contains("preset-empty")) {
					this.handleButtonClick({ target: button });
				}
			}

			// Handle clicks on empty preset slots (for admin)
			if (this.role === "admin" && this.editMode && event.target.classList.contains("preset-empty")) {
				this.handleCreatePreset(parseInt(event.target.getAttribute("data-preset-index")));
			}
		});
	}

	/**
	 * Handle keydown event
	 */
	handleKeyDown(event) {
		// Find preset that matches the pressed key
		const presetIndex = this.presets.findIndex((preset) => preset.key === event.code);

		if (presetIndex !== -1) {
			this.keysPressed[event.code] = true;
			this.updateHighlights();

			// Get the preset and invoke the callback
			const preset = this.presets[presetIndex];
			this.onPresetSelected(preset);
		}
	}

	/**
	 * Handle keyup event
	 */
	handleKeyUp(event) {
		// Find preset that matches the released key
		const presetIndex = this.presets.findIndex((preset) => preset.key === event.code);

		if (presetIndex !== -1) {
			this.keysPressed[event.code] = false;
			this.updateHighlights();
		}
	}

	/**
	 * Handle button click event
	 */
	handleButtonClick(event) {
		const button = event.target;
		const presetIndex = parseInt(button.getAttribute("data-preset-index"));

		if (presetIndex >= 0 && presetIndex < this.presets.length) {
			// Visual feedback
			button.classList.add("pressed");
			setTimeout(() => {
				button.classList.remove("pressed");
			}, 200);

			// In edit mode for admin, clicking should overwrite instead of navigate
			if (this.role === "admin" && this.editMode) {
				this.handleOverwritePreset(presetIndex);
			} else {
				// Invoke the callback with the preset object
				this.onPresetSelected(this.presets[presetIndex]);
			}
		}
	}

	/**
	 * Handle right-click context menu for preset buttons (admin only)
	 */
	handleContextMenu(event) {
		if (!this.editMode) return;

		event.preventDefault();

		// Remove any existing context menu
		this.removeContextMenu();

		const button = event.target;
		const presetIndex = parseInt(button.getAttribute("data-preset-index"));

		if (presetIndex >= 0 && presetIndex < this.presets.length) {
			// Create context menu
			this.contextMenu = document.createElement("div");
			this.contextMenu.className = "context-menu";

			// Position context menu
			this.contextMenu.style.left = `${event.clientX}px`;
			this.contextMenu.style.top = `${event.clientY}px`;

			const deleteItem = document.createElement("div");
			deleteItem.className = "context-menu-item";
			deleteItem.innerHTML = "Delete Preset";
			deleteItem.addEventListener("click", () => {
				this.handleDeletePreset(presetIndex);
				this.removeContextMenu();
			});

			const overwriteItem = document.createElement("div");
			overwriteItem.className = "context-menu-item";
			overwriteItem.innerHTML = "Overwrite with Current View";
			overwriteItem.addEventListener("click", () => {
				this.handleOverwritePreset(presetIndex);
				this.removeContextMenu();
			});

			// Add items to menu
			this.contextMenu.appendChild(overwriteItem);
			this.contextMenu.appendChild(deleteItem);

			// Add to document
			document.body.appendChild(this.contextMenu);
		}
	}

	/**
	 * Remove context menu
	 */
	removeContextMenu() {
		if (this.contextMenu && this.contextMenu.parentNode) {
			document.body.removeChild(this.contextMenu);
			this.contextMenu = null;
		}
	}

	/**
	 * Handle creating a new preset
	 */
	handleCreatePreset(index) {
		if (this.role !== "admin" || !this.editMode) return;

		// Get current camera position and lookAt
		this.getCurrentCameraState((cameraState) => {
			// Validate data to ensure it's not just zeros
			if (this.isValidCameraState(cameraState)) {
				// Create new preset with automatic numbering
				const newPreset = {
					position: cameraState.position,
					lookAt: cameraState.lookAt,
					// No label needed - it will use the default index + 1
				};

				// Insert at specified index
				const updatedPresets = [...this.presets];
				if (index < updatedPresets.length) {
					updatedPresets[index] = newPreset;
				} else {
					updatedPresets.push(newPreset);
				}

				// Update presets
				this.presets = updatedPresets;
				this.updatePresetIds();
				this.renderPresetButtons();
				this.renderAdminControls();

				// Call onUpdate with the full updated presets array
				if (this.onUpdate) {
					this.onUpdate(this.presets);
				}

				// Setup event listeners again since we re-rendered the buttons
				this.setupEventListeners();
			} else {
				console.error("Invalid camera state received:", cameraState);
				alert("Could not create preset: Invalid camera position data received.");
			}
		});
	}

	/**
	 * Check if camera state is valid (not just zeros)
	 */
	isValidCameraState(cameraState) {
		// Check if position and lookAt are arrays
		if (!Array.isArray(cameraState.position) || !Array.isArray(cameraState.lookAt)) {
			return false;
		}

		// Check if position has at least one non-zero value
		const hasNonZeroPosition = cameraState.position.some((value) => Math.abs(value) > 0.001);

		// Check if lookAt has at least one non-zero value
		const hasNonZeroLookAt = cameraState.lookAt.some((value) => Math.abs(value) > 0.001);

		return hasNonZeroPosition || hasNonZeroLookAt;
	}

	/**
	 * Handle deleting a preset
	 */
	handleDeletePreset(index) {
		if (this.role !== "admin" || !this.editMode || index < 0 || index >= this.presets.length) return;

		// Remove preset
		const updatedPresets = [...this.presets];
		updatedPresets.splice(index, 1);

		// Update presets
		this.presets = updatedPresets;
		this.updatePresetIds();
		this.renderPresetButtons();
		this.renderAdminControls();

		// Call onUpdate with the full updated presets array
		if (this.onUpdate) {
			this.onUpdate(this.presets);
		}

		// Setup event listeners again since we re-rendered the buttons
		this.setupEventListeners();
	}

	/**
	 * Handle overwriting a preset with current camera state
	 */
	handleOverwritePreset(index) {
		if (this.role !== "admin" || !this.editMode || index < 0 || index >= this.presets.length) return;

		// Get current preset
		const preset = this.presets[index];

		// Get current camera position and lookAt
		this.getCurrentCameraState((cameraState) => {
			// Validate data to ensure it's not just zeros
			if (this.isValidCameraState(cameraState)) {
				// Update preset
				const updatedPreset = {
					...preset,
					position: cameraState.position,
					lookAt: cameraState.lookAt,
				};

				const updatedPresets = [...this.presets];
				updatedPresets[index] = updatedPreset;

				// Update presets
				this.presets = updatedPresets;

				// Call onUpdate with the full updated presets array
				if (this.onUpdate) {
					this.onUpdate(this.presets);
				}
			} else {
				console.error("Invalid camera state received:", cameraState);
				alert("Could not update preset: Invalid camera position data received.");
			}
		});
	}

	/**
	 * Handle saving current view as a new preset
	 */
	handleSaveCurrentView() {
		if (this.role !== "admin" || !this.editMode) return;

		// Get current camera position and lookAt
		this.getCurrentCameraState((cameraState) => {
			// Validate data to ensure it's not just zeros
			if (this.isValidCameraState(cameraState)) {
				// Create new preset
				const newPreset = {
					position: cameraState.position,
					lookAt: cameraState.lookAt,
					// No label needed - it will use the default index + 1
				};

				// Add new preset if we have less than 9
				if (this.presets.length < 9) {
					const updatedPresets = [...this.presets, newPreset];

					// Update presets
					this.presets = updatedPresets;
					this.updatePresetIds();
					this.renderPresetButtons();
					this.renderAdminControls();

					// Call onUpdate with the full updated presets array
					if (this.onUpdate) {
						this.onUpdate(this.presets);
					}

					// Setup event listeners again since we re-rendered the buttons
					this.setupEventListeners();
				} else {
					alert("Maximum of 9 presets reached. Please delete or overwrite an existing preset.");
				}
			} else {
				console.error("Invalid camera state received:", cameraState);
				alert("Could not create preset: Invalid camera position data received.");
			}
		});
	}

	/**
	 * Get current camera state
	 * This needs to be implemented by the Viewer to provide the current camera state
	 * We're using a callback as this might be an async operation in some implementations
	 */
	getCurrentCameraState(callback) {
		// Create a custom event to request the camera state from the Viewer
		const event = new CustomEvent("request-camera-state", {
			detail: {
				callback: (position, lookAt) => {
					callback({
						position: position,
						lookAt: lookAt,
					});
				},
			},
		});

		document.dispatchEvent(event);
	}

	/**
	 * Update the visual highlighting of buttons based on pressed state
	 */
	updateHighlights() {
		// Get all button elements
		const buttonElements = this.controlsElement.querySelectorAll(".preset-button:not(.preset-empty)");

		// Update each button's appearance
		buttonElements.forEach((button) => {
			const keyCode = button.getAttribute("data-key");
			if (this.keysPressed[keyCode]) {
				button.classList.add("pressed");
			} else {
				button.classList.remove("pressed");
			}
		});
	}

	/**
	 * Set presets
	 * @param {Array} presets - Array of preset objects
	 */
	setPresets(presets) {
		this.presets = presets || [];
		this.updatePresetIds();
		this.renderPresetButtons();
		this.setupEventListeners();
	}

	/**
	 * Get presets
	 * @returns {Array} Array of preset objects
	 */
	getPresets() {
		return this.presets;
	}

	/**
	 * Set role
	 * @param {"admin" | "user"} role - Role
	 */
	setRole(role) {
		this.role = role;
		this.editMode = false; // Reset edit mode when role changes
		this.renderPresetButtons();
		if (this.role === "admin") {
			this.renderAdminControls();
		}
		this.setupEventListeners();
	}

	/**
	 * Detect if device is a mobile device (phone/tablet)
	 * @returns {boolean} True if mobile device
	 */
	detectMobile() {
		// Check if it's a mobile device based on user agent
		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent,
		);

		// Check screen size - typical cutoff for tablets is around 768px width
		const isSmallScreen = window.innerWidth <= 1024;

		// Only hide on mobile devices, not just any touch-enabled device
		return isMobile && isSmallScreen;
	}

	/**
	 * Show the controls
	 */
	show() {
		if (this.controlsElement) {
			// If there are no presets and user is not admin, don't show anything
			if (this.presets.length === 0 && this.role !== "admin") {
				this.controlsElement.style.display = "none";
			} else {
				this.controlsElement.style.display = "flex";
			}
		}
	}

	/**
	 * Hide the controls
	 */
	hide() {
		if (this.controlsElement) {
			this.controlsElement.style.display = "none";
		}
	}

	/**
	 * Remove the component and clean up event listeners
	 */
	dispose() {
		document.removeEventListener("keydown", this.handleKeyDown);
		document.removeEventListener("keyup", this.handleKeyUp);

		// Remove context menu if open
		this.removeContextMenu();

		if (this.controlsElement && this.controlsElement.parentNode) {
			this.container.removeChild(this.controlsElement);
		}
	}
}
