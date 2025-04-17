import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";

export class FloatingLabels {
	constructor(viewer, labelsData = [], callbacks = {}) {
		this.viewer = viewer;
		this.scene = viewer.threeScene;
		this.camera = viewer.camera;
		this.renderer = viewer.renderer; // Store renderer if needed for resolution updates
		this.labels = new Map();
		this.editMode = false;
		this.selectedLabelId = null;

		// Store callbacks
		this.callbacks = {
			onLabelCreate: callbacks.onLabelCreate,
			onLabelUpdate: callbacks.onLabelUpdate,
			onLabelRemove: callbacks.onLabelRemove,
			onModalOpen: callbacks.onModalOpen,
			onModalClose: callbacks.onModalClose,
		};

		// Create a group to hold all labels
		this.labelsGroup = new THREE.Group();
		this.scene.add(this.labelsGroup);

		// Create UI for label editing/creation
		this.createEditUI();

		// Add labels from initial data
		if (labelsData && labelsData.length > 0) {
			this.addLabels(labelsData);
		}

		// Set up integration with viewer update cycle
		this.setupViewerIntegration();

		// Set up click handler for label selection
		this.setupClickHandler();
	}

	setupClickHandler() {
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();

		this.clickHandler = (event) => {
			if (!this.editMode) return;

			// Calculate mouse position in normalized device coordinates
			const rect = this.viewer.renderer.domElement.getBoundingClientRect();
			this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

			// Set up raycaster
			this.raycaster.setFromCamera(this.mouse, this.camera);

			// Create an array of all label objects to test
			const labelObjects = [];
			this.labels.forEach((label, id) => {
				if (label.background) {
					labelObjects.push({ id, object: label.background });
				}
				if (label.textSprite) {
					labelObjects.push({ id, object: label.textSprite });
				}
			});

			// Get all objects that intersect with the ray
			const intersects = this.raycaster.intersectObjects(labelObjects.map((item) => item.object));

			// If we intersected with a label, select it
			if (intersects.length > 0) {
				// Find the id of the label that was clicked
				const clickedObject = intersects[0].object;
				const labelInfo = labelObjects.find((item) => item.object === clickedObject);

				if (labelInfo) {
					// Select this label
					this.selectLabel(labelInfo.id);

					// Show edit UI
					this.showEditUI(labelInfo.id);

					// Prevent further propagation
					event.stopPropagation();
					return;
				}
			}

			// If we clicked outside any label, deselect
			this.deselectLabel();
		};

		// Add the click handler to the renderer's canvas
		this.viewer.renderer.domElement.addEventListener("click", this.clickHandler);
	}

	createEditUI() {
		// Create modal container
		this.editUI = document.createElement("div");
		this.editUI.className = "label-edit-ui";
		this.editUI.style.display = "none";
		this.editUI.style.position = "absolute";
		this.editUI.style.top = "50%";
		this.editUI.style.left = "50%";
		this.editUI.style.transform = "translate(-50%, -50%)";
		this.editUI.style.backgroundColor = "#2a2a2a";
		this.editUI.style.color = "white";
		this.editUI.style.padding = "20px";
		this.editUI.style.borderRadius = "8px";
		this.editUI.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.5)";
		this.editUI.style.zIndex = "1000";
		this.editUI.style.width = "300px";
		this.editUI.style.fontFamily = "Arial, sans-serif";

		// Create UI content
		this.editUI.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 15px;" id="label-modal-title">Edit Label</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Text:</label>
                <input type="text" id="label-text-input" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Background Color:</label>
                    <input type="color" id="label-bg-color" style="width: 100%; height: 30px; background: #3a3a3a; border: 1px solid #555; border-radius: 4px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Text Color:</label>
                    <input type="color" id="label-text-color" style="width: 100%; height: 30px; background: #3a3a3a; border: 1px solid #555; border-radius: 4px;">
                </div>
            </div>
            
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Width:</label>
                    <input type="number" id="label-width" min="0.5" step="0.1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Height:</label>
                    <input type="number" id="label-height" min="0.3" step="0.1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Connector:</label>
                <input type="checkbox" id="label-connector" checked style="margin-right: 5px;">
                <label for="label-connector">Show connector</label>
            </div>
            
            <div id="connector-options" style="margin-bottom: 15px; padding-left: 20px;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Position:</label>
                    <select id="connector-position" style="width: 100%; padding: 8px; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                        <option value="bottom">Bottom</option>
                        <option value="top">Top</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                    </select>
                </div>
                <div style="margin-bottom: 10px; display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px;">Width:</label>
                        <input type="number" id="connector-width" min="1" max="4" step="1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px;">Length:</label>
                        <input type="number" id="connector-length" min="0.1" step="0.1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Color:</label>
                    <input type="color" id="connector-color" style="width: 100%; height: 30px; background: #3a3a3a; border: 1px solid #555; border-radius: 4px;">
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between;">
                <button id="label-delete-btn" style="padding: 8px 15px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                <div>
                    <button id="label-cancel-btn" style="padding: 8px 15px; margin-right: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="label-save-btn" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                </div>
            </div>
        `;

		// Add the UI to document body
		document.body.appendChild(this.editUI);

		// Set up event listeners
		document.getElementById("label-connector").addEventListener("change", (e) => {
			document.getElementById("connector-options").style.display = e.target.checked ? "block" : "none";
		});

		document.getElementById("label-cancel-btn").addEventListener("click", () => {
			this.hideEditUI();
		});

		document.getElementById("label-save-btn").addEventListener("click", () => {
			this.saveEditUIData();
		});

		document.getElementById("label-delete-btn").addEventListener("click", () => {
			if (this.selectedLabelId) {
				this.removeLabel(this.selectedLabelId);
				this.hideEditUI();
			}
		});

		// Close when clicking outside
		window.addEventListener("click", (e) => {
			if (e.target === this.editUI) {
				this.hideEditUI();
			}
		});
	}

	showEditUI(labelId = null) {
		// If labelId is null, we're creating a new label
		const isCreating = !labelId;
		document.getElementById("label-modal-title").textContent = isCreating ? "Create Label" : "Edit Label";
		document.getElementById("label-delete-btn").style.display = isCreating ? "none" : "block";

		if (isCreating) {
			// Default values for new label
			document.getElementById("label-text-input").value = "New Label";
			document.getElementById("label-bg-color").value = "#333333";
			document.getElementById("label-text-color").value = "#ffffff";
			document.getElementById("label-width").value = "1.5";
			document.getElementById("label-height").value = "0.4";
			document.getElementById("label-connector").checked = true;
			document.getElementById("connector-position").value = "top"; // Default to top as requested
			document.getElementById("connector-width").value = "1";
			document.getElementById("connector-length").value = "0.3";
			document.getElementById("connector-color").value = "#ffffff";
		} else {
			// Fill form with label data
			const label = this.labels.get(labelId);
			if (!label) return;

			const options = label.options || {};

			document.getElementById("label-text-input").value = label.text || "";
			document.getElementById("label-bg-color").value = this.colorToHex(options.backgroundColor || "#333333");
			document.getElementById("label-text-color").value = this.colorToHex(options.textColor || "#ffffff");
			document.getElementById("label-width").value = options.width || "1.5";
			document.getElementById("label-height").value = options.height || "0.4";
			document.getElementById("label-connector").checked = options.showConnector !== false;
			document.getElementById("connector-position").value = options.connectorPosition || "bottom";
			document.getElementById("connector-width").value = options.connectorWidth || "1";
			document.getElementById("connector-length").value = options.connectorLength || "0.5";
			document.getElementById("connector-color").value = this.colorToHex(options.connectorColor || "#ffffff");
		}

		// Show/hide connector options
		document.getElementById("connector-options").style.display = document.getElementById("label-connector")
			.checked
			? "block"
			: "none";

		// Show the UI
		this.editUI.style.display = "block";

		if (this.callbacks.onModalOpen) {
			this.callbacks.onModalOpen();
		}

		// Focus on the text input
		document.getElementById("label-text-input").focus();
	}

	colorToHex(color) {
		if (typeof color === "string" && color.startsWith("#")) {
			return color;
		}

		if (color instanceof THREE.Color) {
			return "#" + color.getHexString();
		}

		// Try to parse as a CSS color
		const tempDiv = document.createElement("div");
		tempDiv.style.color = color;
		document.body.appendChild(tempDiv);
		const computedColor = window.getComputedStyle(tempDiv).color;
		document.body.removeChild(tempDiv);

		// Parse RGB values
		const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (match) {
			const r = parseInt(match[1]).toString(16).padStart(2, "0");
			const g = parseInt(match[2]).toString(16).padStart(2, "0");
			const b = parseInt(match[3]).toString(16).padStart(2, "0");
			return `#${r}${g}${b}`;
		}

		return "#333333"; // Default fallback
	}

	hideEditUI() {
		this.editUI.style.display = "none";
		this.deselectLabel();

		if (this.callbacks.onModalClose) {
			this.callbacks.onModalClose();
		}
	}

	saveEditUIData() {
		const text = document.getElementById("label-text-input").value;
		const options = {
			backgroundColor: document.getElementById("label-bg-color").value,
			textColor: document.getElementById("label-text-color").value,
			width: parseFloat(document.getElementById("label-width").value),
			height: parseFloat(document.getElementById("label-height").value),
			showConnector: document.getElementById("label-connector").checked,
			connectorPosition: document.getElementById("connector-position").value,
			connectorWidth: parseFloat(document.getElementById("connector-width").value),
			connectorLength: parseFloat(document.getElementById("connector-length").value),
			connectorColor: document.getElementById("connector-color").value,
		};

		if (this.selectedLabelId) {
			// Update existing label
			const label = this.labels.get(this.selectedLabelId);
			if (label) {
				// Get the original label options
				const oldOptions = label.options || {};

				// Check if connector properties have changed that would affect positioning
				if (
					(options.connectorPosition !== oldOptions.connectorPosition ||
						options.connectorLength !== oldOptions.connectorLength ||
						options.width !== oldOptions.width ||
						options.height !== oldOptions.height) &&
					oldOptions.connectorTarget
				) {
					// Get the target position
					const targetPos = oldOptions.connectorTarget.clone();

					// Get connector and dimension values
					const oldConnectorPosition = oldOptions.connectorPosition || "bottom";
					const newConnectorPosition = options.connectorPosition || oldConnectorPosition;

					const oldConnectorLength = oldOptions.connectorLength || 0.3;
					const newConnectorLength = options.connectorLength || oldConnectorLength;

					const oldHeight = oldOptions.height || 0.4;
					const newHeight = options.height || oldHeight;

					const oldWidth = oldOptions.width || 1.5;
					const newWidth = options.width || oldWidth;

					// Calculate new position from scratch based on target and new parameters
					let newLabelPosition = targetPos.clone();

					switch (newConnectorPosition) {
						case "top":
							// Label should be directly above the target point
							newLabelPosition.y = targetPos.y - (newConnectorLength + newHeight / 2);
							break;
						case "bottom":
							// Label should be directly below the target point
							newLabelPosition.y = targetPos.y + (newConnectorLength + newHeight / 2);
							break;
						case "left":
							// Label should be to the left of the target point
							newLabelPosition.x = targetPos.x - (newConnectorLength + newWidth / 2);
							break;
						case "right":
							// Label should be to the right of the target point
							newLabelPosition.x = targetPos.x + (newConnectorLength + newWidth / 2);
							break;
					}

					// Make sure label doesn't go below ground
					if (newLabelPosition.y < 0.5) {
						newLabelPosition.y = 0.5;
					}

					// Update the label position
					this.updateLabelPosition(this.selectedLabelId, newLabelPosition);

					// Preserve the connector target in the new options
					options.connectorTarget = oldOptions.connectorTarget.clone();
				}

				// Now update the label text and appearance
				this.updateLabelText(this.selectedLabelId, text, options);

				// Call update callback if provided
				if (this.callbacks.onLabelUpdate) {
					const labelData = {
						id: this.selectedLabelId,
						position: label.container.position.toArray(),
						text,
						options,
					};
					this.callbacks.onLabelUpdate(labelData);
				}
			}
		} else if (this.pendingCursorPosition) {
			// Create new label
			const id = `label-${Date.now()}`;
			const position = this.pendingCursorPosition.clone();

			// Get connector position and length
			const connectorPosition = options.connectorPosition || "top";
			const connectorLength = options.connectorLength || 0.3;
			const labelHeight = options.height || 0.4;
			const labelWidth = options.width || 1.5;

			// Calculate label position (at the end of straight line)
			let labelPosition = position.clone();

			// SIMPLE STRAIGHT LINES: Only make label offsets in a single axis
			switch (connectorPosition) {
				case "top":
					// Label should be directly above the point
					labelPosition.y -= connectorLength + labelHeight / 2;
					break;
				case "bottom":
					// Label should be directly below the point
					labelPosition.y += connectorLength + labelHeight / 2;
					break;
				case "left":
					// Label should be to the left of the point
					labelPosition.x -= connectorLength + labelWidth / 2;
					break;
				case "right":
					// Label should be to the right of the point
					labelPosition.x += connectorLength + labelWidth / 2;
					break;
			}

			// Make sure label doesn't go below ground
			if (labelPosition.y < 0.5) {
				labelPosition.y = 0.5;
			}

			// Create label with connector to original point
			const finalOptions = {
				...options,
				connectorTarget: position.clone(),
			};

			this.addLabel(id, labelPosition, text, finalOptions);

			// Call create callback if provided
			if (this.callbacks.onLabelCreate) {
				const labelData = {
					id,
					position: labelPosition.toArray(),
					text,
					options: finalOptions,
				};
				this.callbacks.onLabelCreate(labelData);
			}

			this.pendingCursorPosition = null;
		}

		this.hideEditUI();
	}

	toggleEditMode() {
		this.editMode = !this.editMode;
		console.log(`Label edit mode: ${this.editMode ? "ON" : "OFF"}`);

		// Visual feedback for edit mode
		this.labels.forEach((label) => {
			if (label.background) {
				if (this.editMode) {
					label.originalColor = label.background.material.color.clone();
					label.background.material.color.set(new THREE.Color(0x9966ff));
					label.background.material.opacity = 0.9;
				} else if (label.originalColor) {
					label.background.material.color.copy(label.originalColor);
					label.background.material.opacity = label.options.opacity || 0.8;
				}
			}
		});

		return this.editMode;
	}

	selectLabel(id) {
		// Deselect previous label
		this.deselectLabel();

		// Select new label
		this.selectedLabelId = id;
		const label = this.labels.get(id);

		if (label && label.background) {
			// Store original color before selection
			if (!label.originalColor) {
				label.originalColor = label.background.material.color.clone();
			}

			// Highlight selected label
			label.background.material.color.set(new THREE.Color(0x55ffaa));
			label.background.material.opacity = 0.9;
		}
	}

	deselectLabel() {
		if (this.selectedLabelId) {
			const label = this.labels.get(this.selectedLabelId);

			if (label && label.background) {
				// If in edit mode, use the edit mode color
				if (this.editMode) {
					label.background.material.color.set(new THREE.Color(0x9966ff));
				} else if (label.originalColor) {
					// Otherwise restore original color
					label.background.material.color.copy(label.originalColor);
				}

				label.background.material.opacity = label.options.opacity || 0.8;
			}

			this.selectedLabelId = null;
		}
	}

	createLabelAtCursor() {
		if (!this.editMode || !this.viewer.showMeshCursor) return false;

		// Store the cursor position for later use
		this.pendingCursorPosition = this.viewer.sceneHelper.meshCursor.position.clone();

		// FIX: Make sure cursor position has a minimum height to avoid going under map
		if (this.pendingCursorPosition.y < 0.1) {
			this.pendingCursorPosition.y = 0.1;
		}

		// Show edit UI for the new label
		this.showEditUI();

		return true;
	}

	addLabels(labelsData) {
		if (!labelsData || !Array.isArray(labelsData)) return;

		labelsData.forEach((labelData) => {
			this.addLabel(labelData.id, labelData.position, labelData.text, labelData.options);
		});
	}

	addLabel(id, position, text, options = {}) {
		// Convert position array to Vector3 if needed
		const labelPosition = Array.isArray(position) ? new THREE.Vector3(...position) : position.clone();

		// Clear any existing label with this ID
		if (this.labels.has(id)) {
			this.removeLabel(id);
		}

		// Create the label
		const label = this.createLabelObject(labelPosition, text, options);

		// Store in map
		this.labels.set(id, label);

		// Add to scene
		this.labelsGroup.add(label.container);

		return label;
	}

	createLabelObject(position, text, options = {}) {
		// Create a group to hold all label parts
		const container = new THREE.Group();
		container.position.copy(position);

		// Apply offset if provided
		if (options.offset) {
			const offset = Array.isArray(options.offset) ? new THREE.Vector3(...options.offset) : options.offset;
			container.position.add(offset);
		}

		// Set label dimensions with better defaults for good proportions
		const width = options.width || 1.5;
		const height = options.height || 0.4;

		// Create background plane
		const backgroundColor = options.backgroundColor
			? new THREE.Color(options.backgroundColor)
			: new THREE.Color(0x333333);
		const backgroundOpacity = options.opacity !== undefined ? options.opacity : 0.8;

		// Create a rounded rectangle
		const backgroundGeometry = new THREE.PlaneGeometry(width, height);
		const backgroundMaterial = new THREE.MeshBasicMaterial({
			color: backgroundColor,
			transparent: true,
			opacity: backgroundOpacity,
			side: THREE.DoubleSide,
			depthTest: options.depthTest !== undefined ? options.depthTest : true,
			polygonOffset: true,
			polygonOffsetFactor: 5.0,
			polygonOffsetUnits: 5.0,
		});

		const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);

		background.position.z = 0.004;

		// Create text using canvas texture
		const textSprite = this.createTextSprite(text, {
			width,
			height,
			textColor: options.textColor || "#ffffff",
			font: options.font || "Bold 20px Arial",
			padding: options.padding || 20,
			lineHeight: options.lineHeight || 28,
		});

		// Position text slightly in front of background to prevent z-fighting
		textSprite.position.z = 0.005;

		// Create connector if requested
		let connector = null;
		if (options.showConnector) {
			connector = this.createConnector(options);
			container.add(connector);
		}

		// Add background and text to container - make sure background is added first
		container.add(background);
		container.add(textSprite);

		// Set initial visibility
		container.visible = options.visible !== undefined ? options.visible : true;

		return {
			container,
			background,
			textSprite,
			connector,
			text,
			options,
		};
	}

	createTextSprite(text, options = {}) {
		// Create canvas for rendering text
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");

		// Set higher resolution for better text quality
		const scale = 6; // Higher scale for better text quality
		canvas.width = (options.width || 1) * 256 * scale;
		canvas.height = (options.height || 0.5) * 256 * scale;

		// Clear canvas
		context.clearRect(0, 0, canvas.width, canvas.height);
		// Set up text styling
		context.scale(scale, scale);
		context.font = options.font || "Bold 20px Helvetica";
		context.fillStyle = options.textColor || "#ffffff";
		context.textAlign = options.textAlign || "center";
		context.textBaseline = "middle";

		// Handle multiline text
		const lines = text.split("\\n");
		const lineHeight = options.lineHeight || 28;
		const startY = canvas.height / (2 * scale) - ((lines.length - 1) * lineHeight) / 2;

		// Draw each line of text
		lines.forEach((line, i) => {
			context.fillText(line, canvas.width / (2 * scale), startY + i * lineHeight);
		});

		// Create texture from canvas
		const texture = new THREE.CanvasTexture(canvas);
		// Use better filtering for text sharpness
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;

		// Create sprite material
		const spriteMaterial = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			depthTest: options.depthTest !== undefined ? options.depthTest : true,
		});

		// Create sprite
		const sprite = new THREE.Sprite(spriteMaterial);

		// Scale sprite to match desired dimensions, maintaining aspect ratio
		const aspectRatio = canvas.width / canvas.height;
		sprite.scale.set(options.width || 2, (options.width || 2) / aspectRatio, 1);

		return sprite;
	}

	createConnector(options = {}) {
		const length = options.connectorLength || 0.3;
		const lineWidth = options.connectorWidth || 0.05;
		const color = options.connectorColor
			? new THREE.Color(options.connectorColor)
			: new THREE.Color(0xffffff);

		let points = [];
		const position = options.connectorPosition || "bottom";
		const width = options.width || 1.5;
		const height = options.height || 0.4;

		switch (position) {
			case "top":
				points = [new THREE.Vector3(0, -height / 2, 0), new THREE.Vector3(0, -height / 2 - length, 0)];
				break;
			case "left":
				points = [new THREE.Vector3(width / 2, 0, 0), new THREE.Vector3(width / 2 + length, 0, 0)];
				break;
			case "right":
				points = [new THREE.Vector3(-width / 2, 0, 0), new THREE.Vector3(-width / 2 - length, 0, 0)];
				break;
			case "bottom":
			default:
				points = [new THREE.Vector3(0, height / 2, 0), new THREE.Vector3(0, height / 2 + length, 0)];
				break;
		}

		// Create Line2 geometry
		const geometry = new LineGeometry();
		const positions = [];

		points.forEach((point) => {
			positions.push(point.x, point.y, point.z);
		});

		geometry.setPositions(positions);

		const initialResolution = new THREE.Vector2();
		if (this.renderer) {
			// Check if renderer exists yet
			this.renderer.getDrawingBufferSize(initialResolution);
		} else {
			// Fallback if renderer isn't ready (might happen if called very early)
			initialResolution.set(window.innerWidth, window.innerHeight);
			console.warn(
				"Renderer not available during connector creation, using window size as fallback resolution.",
			);
		}

		// Create LineMaterial with proper width support
		const material = new LineMaterial({
			color: color,
			linewidth: lineWidth * 0.005, // Interpreted as world units
			worldUnits: true, // <--- Set this to true
			transparent: true,
			opacity: options.opacity !== undefined ? options.opacity : 0.8,
			resolution: initialResolution, // Still good practice to set, though less critical for worldUnits width
			dashed: false,
		});

		// Create Line2 instance
		const connector = new Line2(geometry, material);

		// Make sure lines are drawn with correct width regardless of camera distance
		connector.computeLineDistances();

		return connector;
	}

	removeLabel(id) {
		const label = this.labels.get(id);
		if (!label) return;

		// Remove from scene
		this.labelsGroup.remove(label.container);

		// Clean up resources
		if (label.textSprite && label.textSprite.material) {
			label.textSprite.material.map?.dispose();
			label.textSprite.material.dispose();
		}

		if (label.background && label.background.material) {
			label.background.material.dispose();
			label.background.geometry.dispose();
		}

		if (label.connector && label.connector.material) {
			label.connector.material.dispose();
			if (label.connector.geometry) {
				label.connector.geometry.dispose();
			}
		}

		// Remove from our map
		this.labels.delete(id);

		// Call the remove callback if provided
		if (this.callbacks.onLabelRemove) {
			this.callbacks.onLabelRemove(id);
		}
	}

	clearAllLabels() {
		// Get all label IDs
		const labelIds = Array.from(this.labels.keys());

		// Remove all labels one by one
		for (const id of labelIds) {
			this.removeLabel(id);
		}
	}

	setLabelVisibility(id, visible) {
		const label = this.labels.get(id);
		if (label) {
			label.container.visible = visible;
		}
	}

	updateLabelPosition(id, newPosition) {
		const label = this.labels.get(id);
		if (!label) return;

		// Ensure minimum height to prevent going under the map
		let finalPosition;
		if (Array.isArray(newPosition)) {
			finalPosition = new THREE.Vector3(newPosition[0], newPosition[1], newPosition[2]);
			if (finalPosition.y < 0.5) {
				finalPosition.y = 0.5;
			}
		} else {
			finalPosition = newPosition.clone();
			if (finalPosition.y < 0.5) {
				finalPosition.y = 0.5;
			}
		}

		// Update position
		label.container.position.copy(finalPosition);

		// If there's a connector target, we may need to update it
		if (label.options.connectorTarget && label.connector) {
			// Recreate the connector to ensure it points to the right place
			label.container.remove(label.connector);
			if (label.connector.material) {
				label.connector.material.dispose();
			}
			if (label.connector.geometry) {
				label.connector.geometry.dispose();
			}

			// Create new connector
			label.connector = this.createConnector(label.options);
			label.container.add(label.connector);
		}
	}

	updateLabelText(id, newText, newOptions = {}) {
		const label = this.labels.get(id);
		if (!label) return;

		// Update text
		label.text = newText;

		// Clean up old text sprite
		if (label.textSprite && label.textSprite.material) {
			label.container.remove(label.textSprite);
			label.textSprite.material.map?.dispose();
			label.textSprite.material.dispose();
		}

		// Merge options
		const mergedOptions = { ...label.options, ...newOptions };
		label.options = mergedOptions;

		// Create new text sprite
		label.textSprite = this.createTextSprite(newText, {
			width: mergedOptions.width || 1.5,
			height: mergedOptions.height || 0.4,
			textColor: mergedOptions.textColor || "#ffffff",
			font: mergedOptions.font || "Bold 20px Arial",
			padding: mergedOptions.padding || 20,
			lineHeight: mergedOptions.lineHeight || 28,
		});

		label.textSprite.position.z = 0.005;

		// Clean up and recreate if options changed
		if (
			newOptions.width ||
			newOptions.height ||
			newOptions.backgroundColor ||
			newOptions.opacity ||
			newOptions.showConnector ||
			newOptions.connectorWidth ||
			newOptions.connectorLength ||
			newOptions.connectorColor ||
			newOptions.connectorPosition ||
			newOptions.connectorTarget
		) {
			// Clean up old background
			if (label.background && label.background.material) {
				label.container.remove(label.background);
				label.background.material.dispose();
				label.background.geometry.dispose();
			}

			// Create new background
			const backgroundGeometry = new THREE.PlaneGeometry(
				mergedOptions.width || 1.5,
				mergedOptions.height || 0.4,
			);

			const backgroundColor = mergedOptions.backgroundColor
				? new THREE.Color(mergedOptions.backgroundColor)
				: new THREE.Color(0x333333);

			const backgroundMaterial = new THREE.MeshBasicMaterial({
				color: backgroundColor,
				transparent: true,
				opacity: mergedOptions.opacity || 0.8,
				side: THREE.DoubleSide,
			});

			label.background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);

			// Clean up old connector
			if (label.connector) {
				label.container.remove(label.connector);
				label.connector.material.dispose();
				if (label.connector.geometry) {
					label.connector.geometry.dispose();
				}
				label.connector = null;
			}

			// Create new connector if needed
			if (mergedOptions.showConnector) {
				label.connector = this.createConnector(mergedOptions);
				label.container.add(label.connector);
			}

			// Add background and text in correct order
			label.container.add(label.background);
		}

		// Always add text last so it's on top
		label.container.add(label.textSprite);
	}

	/**
	 * Update a label's appearance
	 * @private
	 */
	updateLabelAppearance(label, options) {
		// Remove old parts
		if (label.background) {
			label.container.remove(label.background);
			label.background.material.dispose();
			label.background.geometry.dispose();
		}

		if (label.connector) {
			label.container.remove(label.connector);
			label.connector.material.dispose();
			label.connector.geometry.dispose();
			label.connector = null;
		}

		// Create new parts
		const width = options.width || 1.5;
		const height = options.height || 0.4;

		// Create connector if requested
		if (options.showConnector) {
			label.connector = this.createConnector(options);
			label.container.add(label.connector);
		}

		// Create new background
		const roundedRect = this.createRoundedRectangle(width, height, 0.1);
		const backgroundMaterial = new THREE.MeshBasicMaterial({
			color: options.backgroundColor ? new THREE.Color(options.backgroundColor) : new THREE.Color(0x333333),
			transparent: true,
			opacity: options.opacity || 0.8,
			side: THREE.DoubleSide,
		});

		label.background = new THREE.Mesh(roundedRect, backgroundMaterial);
		label.container.add(label.background);

		// Make sure the text sprite is added last so it renders on top
		if (label.textSprite) {
			label.container.remove(label.textSprite);
			label.container.add(label.textSprite);
		}
	}

	/**
	 * Update all labels (called during render loop)
	 */
	update() {
		if (!this.camera) return;

		this.labels.forEach((label) => {
			// Make label face the camera (billboard effect)
			label.container.quaternion.copy(this.camera.quaternion);

			// Distance-based effects if enabled
			if (label.options.fadeWithDistance) {
				const distance = label.container.position.distanceTo(this.camera.position);
				const fadeStartDistance = label.options.fadeStartDistance || 10;
				const fadeEndDistance = label.options.fadeEndDistance || 30;

				const opacity = Math.max(
					0,
					Math.min(1, 1 - (distance - fadeStartDistance) / (fadeEndDistance - fadeStartDistance)),
				);

				// Apply opacity to all components
				if (label.background) {
					label.background.material.opacity = opacity * (label.options.opacity || 0.8);
				}

				if (label.textSprite) {
					label.textSprite.material.opacity = opacity;
				}

				if (label.connector) {
					label.connector.material.opacity = opacity * (label.options.opacity || 0.8);
				}

				// Hide completely when fully transparent
				label.container.visible = opacity > 0.01;
			}
		});
	}

	/**
	 * Setup integration with the viewer's render/update loop
	 * @private
	 */
	setupViewerIntegration() {
		// If the viewer has a self-driven update loop
		if (this.viewer.update) {
			const originalUpdate = this.viewer.update;
			const self = this;

			this.viewer.update = function (renderer, camera) {
				originalUpdate.call(this, renderer, camera);
				self.update();
			};
		}
	}

	/**
	 * Show all labels
	 */
	show() {
		this.labelsGroup.visible = true;
	}

	/**
	 * Hide all labels
	 */
	hide() {
		this.labelsGroup.visible = false;
	}

	/**
	 * Clean up resources and remove labels
	 */
	dispose() {
		if (this.editUI && this.editUI.style.display !== "none") {
			this.hideEditUI(); // This will trigger the onModalClose callback
		}
		if (this.editUI && this.editUI.parentNode) {
			document.body.removeChild(this.editUI);
			this.editUI = null;
		}
		// Remove modal
		if (this.modal && this.modal.parentNode) {
			document.body.removeChild(this.modal);
			this.modal = null;
		}

		window.removeEventListener("resize", this.handleResize); // If you added resize handling
		this.viewer.renderer.domElement.removeEventListener("click", this.clickHandler); // Cleanup click handler

		this.clearAllLabels();
		if (this.labelsGroup) {
			this.scene?.remove(this.labelsGroup); // Add safety check for scene
			this.labelsGroup = null;
		}
		this.viewer = null;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
	}
}
