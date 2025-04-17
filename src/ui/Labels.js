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
				// Only test background for selection for simplicity
				if (label.background) {
					labelObjects.push({ id, object: label.background });
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
			this.hideEditUI(); // Hide UI if clicking outside
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
                        <option value="bottom">Below Target</option>
                        <option value="top">Above Target</option>
                        <option value="left">Right of Target</option>
                        <option value="right">Left of Target</option>
                    </select>
                </div>
                <div style="margin-bottom: 10px; display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px;">Width (px):</label>
                        <input type="number" id="connector-width" min="1" max="10" step="1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
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

		// --- Event Listeners ---
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

		// Prevent click inside UI from triggering the window click listener
		this.editUI.addEventListener("click", (event) => {
			event.stopPropagation();
		});
	}

	showEditUI(labelId = null) {
		this.selectedLabelId = labelId; // Store selected ID regardless of create/edit
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
			document.getElementById("connector-position").value = "top"; // Default: Label Above Target
			document.getElementById("connector-width").value = "2"; // Default width in pixels
			document.getElementById("connector-length").value = "0.5"; // Default length
			document.getElementById("connector-color").value = "#ffffff";
		} else {
			// Fill form with existing label data
			const label = this.labels.get(labelId);
			if (!label) return;
			const options = label.options || {};

			document.getElementById("label-text-input").value = label.text || "";
			document.getElementById("label-bg-color").value = this.colorToHex(options.backgroundColor || "#333333");
			document.getElementById("label-text-color").value = this.colorToHex(options.textColor || "#ffffff");
			document.getElementById("label-width").value = options.width || "1.5";
			document.getElementById("label-height").value = options.height || "0.4";
			document.getElementById("label-connector").checked = options.showConnector !== false;
			document.getElementById("connector-position").value = options.connectorPosition || "top";
			document.getElementById("connector-width").value = options.connectorWidth || "2";
			document.getElementById("connector-length").value = options.connectorLength || "0.5";
			document.getElementById("connector-color").value = this.colorToHex(options.connectorColor || "#ffffff");
		}

		// Show/hide connector options based on checkbox
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
		const textInput = document.getElementById("label-text-input");
		textInput.focus();
		textInput.select();
	}

	colorToHex(color) {
		// ... (implementation is fine)
		if (typeof color === "string" && color.startsWith("#")) {
			return color;
		}
		if (color instanceof THREE.Color) {
			return "#" + color.getHexString();
		}
		const tempDiv = document.createElement("div");
		tempDiv.style.color = color;
		document.body.appendChild(tempDiv);
		const computedColor = window.getComputedStyle(tempDiv).color;
		document.body.removeChild(tempDiv);
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
		if (this.editUI.style.display !== "none") {
			this.editUI.style.display = "none";
			this.deselectLabel(); // Deselect when hiding

			if (this.callbacks.onModalClose) {
				this.callbacks.onModalClose();
			}
		}
	}

	saveEditUIData() {
		const text = document.getElementById("label-text-input").value;
		// Read all options directly from the form
		const currentOptions = {
			backgroundColor: document.getElementById("label-bg-color").value,
			textColor: document.getElementById("label-text-color").value,
			width: parseFloat(document.getElementById("label-width").value) || 1.5,
			height: parseFloat(document.getElementById("label-height").value) || 0.4,
			showConnector: document.getElementById("label-connector").checked,
			connectorPosition: document.getElementById("connector-position").value,
			connectorWidth: parseFloat(document.getElementById("connector-width").value) || 2,
			connectorLength: parseFloat(document.getElementById("connector-length").value) || 0.5,
			connectorColor: document.getElementById("connector-color").value,
			// depthTest: true, // Assuming default from getDefaultLabelOptions
		};

		if (this.selectedLabelId) {
			// --- Update Existing Label ---
			const label = this.labels.get(this.selectedLabelId);
			if (label) {
				const oldOptions = label.options || {};
				// Determine if visual geometry/positioning needs full update
				const appearanceChanged =
					currentOptions.width !== oldOptions.width ||
					currentOptions.height !== oldOptions.height ||
					currentOptions.backgroundColor !== oldOptions.backgroundColor ||
					currentOptions.opacity !== oldOptions.opacity || // Include opacity if added
					currentOptions.showConnector !== oldOptions.showConnector ||
					currentOptions.connectorPosition !== oldOptions.connectorPosition ||
					currentOptions.connectorWidth !== oldOptions.connectorWidth ||
					currentOptions.connectorLength !== oldOptions.connectorLength ||
					currentOptions.connectorColor !== oldOptions.connectorColor ||
					currentOptions.textColor !== oldOptions.textColor || // Text style change needs full redraw
					currentOptions.font !== oldOptions.font; // Font change needs full redraw

				const textChanged = text !== label.text;

				// Preserve the target position
				currentOptions.connectorTarget =
					label.options.connectorTarget?.clone() || label.container.position.clone();

				// Call updateLabelText - it will handle merging and conditional recreation
				// Pass flag indicating if appearance or text changed
				this.updateLabelText(this.selectedLabelId, text, currentOptions, appearanceChanged || textChanged);

				delete label.originalColor;
				delete label.originalOpacity;
				console.log(`[saveEditUIData] Cleared originalColor state for label ${this.selectedLabelId}`);

				// Call update callback
				if (this.callbacks.onLabelUpdate) {
					const updatedLabel = this.labels.get(this.selectedLabelId); // Get potentially updated label object
					const labelData = {
						id: this.selectedLabelId,
						position: updatedLabel.container.position.toArray(), // Position is the target point
						text,
						options: updatedLabel.options, // Pass the final merged options
					};
					this.callbacks.onLabelUpdate(labelData);
				}
			}
		} else if (this.pendingCursorPosition) {
			// --- Create New Label ---
			const id = `label-${Date.now()}`;
			const targetPosition = this.pendingCursorPosition.clone();

			// Create label with the options read from the form
			this.addLabel(id, targetPosition, text, currentOptions);

			// Call create callback
			if (this.callbacks.onLabelCreate) {
				const newLabel = this.labels.get(id); // Get the created label
				const labelData = {
					id,
					position: targetPosition.toArray(),
					text,
					options: newLabel.options, // Use options from the created label object
				};
				this.callbacks.onLabelCreate(labelData);
			}
			this.pendingCursorPosition = null;
		}

		this.hideEditUI(true);
	}

	toggleEditMode() {
		this.editMode = !this.editMode; // Toggle state FIRST
		console.log(`[toggleEditMode] Set editMode to: ${this.editMode}`);

		this.labels.forEach((label, id) => {
			// Added ID for logging
			if (label.background && label.background.material) {
				// Check material too

				if (this.editMode) {
					// --- Turning Edit Mode ON ---
					// Store current options color ONLY if originalColor isn't already set
					// (prevents overwriting if toggling quickly)
					if (label.originalColor === undefined) {
						label.originalColor = this.colorToHex(label.options.backgroundColor); // Store from options
						label.originalOpacity = label.options.opacity;
						console.log(`[toggleEditMode ON] Stored original color: ${label.originalColor} for ${id}`);
					}
					// Set edit mode style
					label.background.material.color.setHex(0x9966ff); // Set to purple
					label.background.material.opacity = 0.9;
					console.log(`[toggleEditMode ON] Set edit mode purple for ${id}`);
				} else {
					// --- Turning Edit Mode OFF ---
					// Restore directly from the label's current SAVED options
					const optionsColor = this.colorToHex(label.options.backgroundColor);
					const optionsOpacity = label.options.opacity;
					label.background.material.color.set(optionsColor); // Use set() which handles hex strings
					label.background.material.opacity = optionsOpacity;
					console.log(`[toggleEditMode OFF] Restored color from options: ${optionsColor} for ${id}`);

					// **Important:** Clear the stored original state now that edit mode is off
					// This ensures next time edit mode is turned ON, it stores the *current* options color.
					delete label.originalColor;
					delete label.originalOpacity;
				}
			} else {
				console.warn(`[toggleEditMode] Label ${id} missing background or material.`);
			}
		});

		// If exiting edit mode, deselect any selected label
		// deselectLabel(false) will now correctly restore from options because editMode is false
		if (!this.editMode) {
			this.deselectLabel(false);
			this.hideEditUI(false); // Also hide UI
		}
		return this.editMode;
	}

	selectLabel(id) {
		if (!this.editMode) return; // Can only select in edit mode

		// Deselect previous label first
		this.deselectLabel();

		// Select new label
		this.selectedLabelId = id;
		const label = this.labels.get(id);

		if (label && label.background) {
			// Store original color if switching selection in edit mode
			if (label.originalColor === undefined) {
				label.originalColor = label.background.material.color.getHex();
				label.originalOpacity = label.background.material.opacity;
			}
			// Highlight selected label (different from general edit mode color)
			label.background.material.color.setHex(0xffaa55); // Selection highlight color
			label.background.material.opacity = 0.95;
		}
	}

	deselectLabel(keepSavedColor = false) {
		if (this.selectedLabelId) {
			const label = this.labels.get(this.selectedLabelId);
			if (label && label.background && label.background.material) {
				console.log(
					`[deselectLabel] EditMode: ${this.editMode}, KeepSaved: ${keepSavedColor}, LabelID: ${this.selectedLabelId}`,
				);

				// If we are NOT in edit mode anymore, restore from options
				if (!this.editMode) {
					const optionsColor = this.colorToHex(label.options.backgroundColor);
					label.background.material.color.set(optionsColor);
					label.background.material.opacity = label.options.opacity;
					console.log(`[deselectLabel] Restored color from options: ${optionsColor}`);
					// Ensure originalColor tracker is clear when not in edit mode
					delete label.originalColor;
					delete label.originalOpacity;
				} else if (this.editMode) {
					if (!keepSavedColor) {
						label.background.material.color.setHex(0x9966ff); // Standard edit mode color
						label.background.material.opacity = 0.9;
						console.log("[deselectLabel] Set color to standard edit mode purple.");
					} else {
						console.log("[deselectLabel] Keeping saved color (keepSavedColor=true).");
					}
				}
			}
			this.selectedLabelId = null;
		}
	}
	createLabelAtCursor() {
		if (!this.editMode || !this.viewer.showMeshCursor) return false;

		this.pendingCursorPosition = this.viewer.sceneHelper.meshCursor.position.clone();
		// Optional: Adjust height if needed
		if (this.pendingCursorPosition.y < 0.1) {
			this.pendingCursorPosition.y = 0.1;
		}

		this.deselectLabel(); // Deselect any current label before creating new
		this.showEditUI(null); // Show UI for creation

		return true;
	}

	addLabels(labelsData) {
		if (!labelsData || !Array.isArray(labelsData)) return;
		labelsData.forEach((labelData) => {
			this.addLabel(labelData.id, labelData.position, labelData.text, labelData.options);
		});
	}

	addLabel(id, position, text, options = {}) {
		if (this.labels.has(id)) {
			this.removeLabel(id);
		}

		const targetPosition = Array.isArray(position) ? new THREE.Vector3(...position) : position.clone();
		// Merge provided options with defaults BEFORE creating object
		const finalOptions = { ...this.getDefaultLabelOptions(), ...options };
		const label = this.createLabelObject(targetPosition, text, finalOptions); // Pass final options
		this.labels.set(id, label);
		this.labelsGroup.add(label.container);
		// **** ADD LOG ****
		console.log(
			`[addLabel ${id}] Label container added to labelsGroup. Group children: ${this.labelsGroup.children.length}, Group visible: ${this.labelsGroup.visible}`,
		);

		return label;
	}

	createLabelObject(targetPosition, text, options = {}) {
		// Options should already be merged with defaults here
		const container = new THREE.Group();
		container.position.copy(targetPosition);
		// Make label face the camera initially - will be updated in loop
		container.quaternion.copy(this.camera.quaternion);

		// Use merged options directly
		const width = options.width;
		const height = options.height;

		const visualOffset = this.calculateVisualOffset(options); // Use helper
		options.calculatedVisualOffset = visualOffset.clone(); // Store for later use
		options.connectorTarget = targetPosition.clone(); // Store anchor point

		console.log(
			`[createLabelObject ${targetPosition
				.toArray()
				.map((p) => p.toFixed(2))}] TargetPos, VisualOffset: ${visualOffset
				.toArray()
				.map((p) => p.toFixed(2))}`,
		);

		// --- Create Visual Elements ---
		const background = this.createBackgroundMesh(width, height, options);
		background.position.copy(visualOffset);
		// background.position.z = -0.002; // REMOVED Z-offset
		console.log(
			`[createLabelObject] Background created. Pos: ${background.position
				.toArray()
				.map((p) => p.toFixed(2))}, Visible: ${background.visible}, Scale: ${background.scale
				.toArray()
				.map((p) => p.toFixed(2))}, Material Opacity: ${background.material.opacity}, RenderOrder: ${
				background.renderOrder
			}`,
		);
		container.add(background);

		const textSprite = this.createTextSprite(text, options); // Pass merged options
		textSprite.position.copy(visualOffset);
		// textSprite.position.z = 0.001; // REMOVED Z-offset
		console.log(
			`[createLabelObject] TextSprite created. Pos: ${textSprite.position
				.toArray()
				.map((p) => p.toFixed(2))}, Visible: ${textSprite.visible}, Scale: ${textSprite.scale
				.toArray()
				.map((p) => p.toFixed(2))}, Material Opacity: ${textSprite.material.opacity}, RenderOrder: ${
				textSprite.renderOrder
			}`,
		);
		container.add(textSprite);

		let connector = null;
		if (options.showConnector) {
			connector = this.createConnector(visualOffset, options);
			console.log(
				`[createLabelObject] Connector created. Visible: ${connector?.visible}, RenderOrder: ${connector.renderOrder}`,
			);
			container.add(connector);
			console.log(`[createLabelObject] Connector added. Container children: ${container.children.length}`);
		}

		// Set initial visibility for the container itself
		container.visible = options.visible; // Use merged option
		// Force child visibility (debugging)
		if (background) background.visible = true;
		if (textSprite) textSprite.visible = true;
		if (connector) connector.visible = true;

		console.log(
			`[createLabelObject] Final container settings. Visible: ${
				container.visible
			}, Position: ${container.position.toArray().map((p) => p.toFixed(2))}`,
		);

		return { container, background, textSprite, connector, text, options };
	}

	// Helper to create background mesh
	createBackgroundMesh(width, height, options) {
		const geometry = new THREE.PlaneGeometry(width, height);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(options.backgroundColor), // Use directly from options
			transparent: true, // Background likely needs transparency
			opacity: options.opacity, // Use directly from options
			side: THREE.DoubleSide,
			depthTest: options.depthTest, // Use directly from options
			// polygonOffset: true, // REMOVED
			// polygonOffsetFactor: 1.0,
			// polygonOffsetUnits: 4.0,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.renderOrder = options.renderOrderBackground; // Use directly from options
		return mesh;
	}

	// Helper to create text sprite
	createTextSprite(text, options = {}) {
		console.log(`[createTextSprite] Called with text: "${text}"`, options);

		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		const font = options.font; // Use directly from options
		const textColor = options.textColor; // Use directly from options
		const width = options.width; // Desired world width
		const height = options.height; // Desired world height
		const padding = options.padding; // Use directly from options
		const scale = 4; // Resolution scale factor

		// --- 1. Calculate required canvas size ---
		context.font = font; // Set font early to measure text accurately
		const lines = text ? text.split("\\n") : [""]; // Handle null/empty text
		let maxTextWidth = 0;
		lines.forEach((line) => (maxTextWidth = Math.max(maxTextWidth, context.measureText(line).width)));
		const fontSize = parseInt(font, 10) || 24;
		const estimatedLineHeight = fontSize * 1.2;
		const totalTextHeight = estimatedLineHeight * lines.length;
		const canvasWidthPixels = Math.max(1, Math.ceil(maxTextWidth + padding * 2));
		const canvasHeightPixels = Math.max(1, Math.ceil(totalTextHeight + padding * 2));
		const canvasWidth = canvasWidthPixels * scale;
		const canvasHeight = canvasHeightPixels * scale;

		console.log(
			`[createTextSprite] Text: "${text}", MaxTextWidth: ${maxTextWidth.toFixed(
				1,
			)}, TotalTextHeight: ${totalTextHeight.toFixed(
				1,
			)}, Calculated Canvas Px: ${canvasWidthPixels}x${canvasHeightPixels}, Scaled Canvas: ${canvasWidth}x${canvasHeight}, Font: ${font}`,
		);

		// --- 2. Check for invalid canvas size ---
		if (canvasWidth <= 0 || canvasHeight <= 0) {
			console.error(
				"[createTextSprite] Calculated canvas dimensions are invalid!",
				canvasWidth,
				canvasHeight,
			);
			const errorMat = new THREE.SpriteMaterial({
				color: 0xff00ff,
				sizeAttenuation: options.sizeAttenuation,
			});
			const errorSprite = new THREE.Sprite(errorMat);
			errorSprite.scale.set(width, height, 1);
			return errorSprite;
		}

		canvas.width = canvasWidth;
		canvas.height = canvasHeight;

		// --- 3. Draw text onto canvas ---
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.scale(scale, scale);
		context.font = font;
		context.fillStyle = textColor;
		context.textAlign = "center";
		context.textBaseline = "middle";
		const startX = canvasWidthPixels / 2;
		const startY = canvasHeightPixels / 2 - (totalTextHeight - estimatedLineHeight) / 2;
		lines.forEach((line, i) => {
			const lineY = startY + i * estimatedLineHeight;
			console.log(
				`[createTextSprite] Drawing line ${i}: "${line}" at ${startX.toFixed(1)}, ${lineY.toFixed(
					1,
				)} (logical px)`,
			);
			context.fillText(line, startX, lineY);
		});

		// **** OPTIONAL DEBUG: Append canvas to body for visual check ****

		// const existingDebugCanvas = document.getElementById('debugLabelCanvas');
		// if (existingDebugCanvas) document.body.removeChild(existingDebugCanvas);
		// canvas.id = 'debugLabelCanvas';
		// canvas.style.border = "1px solid red";
		// canvas.style.position = "fixed"; canvas.style.top = "10px"; canvas.style.left = "10px";
		// canvas.style.width = `${canvasWidthPixels}px`; canvas.style.height = `${canvasHeightPixels}px`;
		// canvas.style.backgroundColor = "rgba(0,0,0,0.3)"; canvas.style.zIndex = "9999";
		// document.body.appendChild(canvas);
		// console.log('[createTextSprite] DEBUG CANVAS APPENDED TO BODY');

		// **** END OPTIONAL DEBUG ****

		// --- 4. Create texture ---
		const texture = new THREE.CanvasTexture(canvas);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.needsUpdate = true;
		console.log("[createTextSprite] CanvasTexture created:", texture);
		if (!texture.image) console.error("[createTextSprite] Texture image (canvas) is missing!");

		// --- 5. Create sprite material ---
		const spriteMaterial = new THREE.SpriteMaterial({
			map: texture,
			transparent: true, // KEEP: Text needs transparency
			// alphaTest: 0.1, // REMOVED
			// depthWrite: false, // REMOVED
			depthTest: options.depthTest, // Use directly from options
			sizeAttenuation: options.sizeAttenuation, // Use directly from options
		});
		spriteMaterial.needsUpdate = true;
		console.log("[createTextSprite] SpriteMaterial created:", spriteMaterial);
		if (!spriteMaterial.map) console.error("[createTextSprite] Material map is null after creation!");

		// --- 6. Create sprite ---
		const sprite = new THREE.Sprite(spriteMaterial);
		const textureAspect = canvas.width / canvas.height;

		// Use the desired world height (from options) as the primary scale factor
		const spriteHeight = height; // height comes from options.height

		// Calculate the corresponding world width for the sprite to maintain the texture's aspect ratio
		const spriteWidth = spriteHeight * textureAspect;

		// Set the sprite scale using the calculated dimensions
		sprite.scale.set(spriteWidth, spriteHeight, 1);
		sprite.renderOrder = options.renderOrderText; // Use directly from options
		console.log("[createTextSprite] Sprite created:", sprite);
		if (sprite.scale.x <= 0 || sprite.scale.y <= 0)
			console.warn("[createTextSprite] Sprite scale is zero or negative!", sprite.scale);

		return sprite;
	}

	// Helper to create connector line
	createConnector(visualOffset, options = {}) {
		const lineWidth = options.connectorWidth; // Use directly from options
		const color = new THREE.Color(options.connectorColor); // Use directly from options
		const width = options.width; // Use directly from options
		const height = options.height; // Use directly from options
		const connectorPosition = options.connectorPosition; // Use directly from options

		const startPoint = visualOffset.clone();
		switch (connectorPosition) {
			case "top":
				startPoint.y -= height / 2;
				break; // Start from bottom edge of label
			case "left":
				startPoint.x -= width / 2;
				break; // Start from left edge
			case "right":
				startPoint.x += width / 2;
				break; // Start from right edge
			case "bottom":
			default:
				startPoint.y += height / 2;
				break; // Start from top edge
		}
		const endPoint = new THREE.Vector3(0, 0, 0); // Target point (container origin)

		const geometry = new LineGeometry();
		geometry.setPositions([startPoint.x, startPoint.y, startPoint.z, endPoint.x, endPoint.y, endPoint.z]);

		const resolution = new THREE.Vector2();
		if (this.renderer) this.renderer.getDrawingBufferSize(resolution);
		else resolution.set(window.innerWidth, window.innerHeight);

		const material = new LineMaterial({
			color: color,
			linewidth: lineWidth,
			resolution: resolution,
			transparent: true, // Connector might need transparency
			opacity: options.opacity, // Use main opacity
			dashed: false,
			depthTest: options.depthTest, // Use directly from options
			// polygonOffset: true, // REMOVED
			// polygonOffsetFactor: 1.0,
			// polygonOffsetUnits: 2.0,
		});
		const connector = new Line2(geometry, material);
		connector.computeLineDistances();
		connector.renderOrder = options.renderOrderConnector; // Use directly from options

		return connector;
	}

	// --- Update and Removal ---

	updateLabelText(id, newText, newOptions = {}, forceFullRedraw = false) {
		const label = this.labels.get(id);
		if (!label) return;

		const oldOptions = { ...label.options }; // Copy old options for comparison
		label.text = newText; // Update text property
		// Merge options: Start with defaults, layer old, layer new
		const mergedOptions = {
			...this.getDefaultLabelOptions(),
			...oldOptions,
			...newOptions,
		};
		label.options = mergedOptions; // Store the final merged options back onto the label object

		// Determine if we need a full redraw vs just updating text texture
		const appearanceChanged =
			forceFullRedraw ||
			mergedOptions.width !== oldOptions.width ||
			mergedOptions.height !== oldOptions.height ||
			mergedOptions.backgroundColor !== oldOptions.backgroundColor ||
			mergedOptions.opacity !== oldOptions.opacity ||
			mergedOptions.showConnector !== oldOptions.showConnector ||
			mergedOptions.connectorPosition !== oldOptions.connectorPosition ||
			mergedOptions.connectorWidth !== oldOptions.connectorWidth ||
			mergedOptions.connectorLength !== oldOptions.connectorLength ||
			mergedOptions.connectorColor !== oldOptions.connectorColor ||
			mergedOptions.textColor !== oldOptions.textColor ||
			mergedOptions.font !== oldOptions.font ||
			mergedOptions.offset !== oldOptions.offset; // Check explicit offset change

		if (appearanceChanged) {
			console.log(`[updateLabelText - ${id}] Appearance changed, full redraw.`);
			// Full redraw: Remove all, recalculate offset, recreate all
			this.cleanupLabelElements(label); // Helper for cleanup
			const newVisualOffset = this.calculateVisualOffset(mergedOptions);
			// Store new offset in the merged options AND back onto the label object itself
			mergedOptions.calculatedVisualOffset = newVisualOffset.clone();
			label.options.calculatedVisualOffset = newVisualOffset.clone();

			label.background = this.createBackgroundMesh(mergedOptions.width, mergedOptions.height, mergedOptions);
			label.background.position.copy(newVisualOffset);
			// label.background.position.z = -0.002; // REMOVED Z-offset
			label.container.add(label.background);

			label.textSprite = this.createTextSprite(newText, mergedOptions);
			label.textSprite.position.copy(newVisualOffset);
			// label.textSprite.position.z = 0.001; // REMOVED Z-offset
			label.container.add(label.textSprite);

			if (mergedOptions.showConnector) {
				label.connector = this.createConnector(newVisualOffset, mergedOptions);
				label.container.add(label.connector);
			}
			// Ensure visibility after recreation
			if (label.background) label.background.visible = true;
			if (label.textSprite) label.textSprite.visible = true;
			if (label.connector) label.connector.visible = true;
		} else {
			console.log(`[updateLabelText - ${id}] Only text changed, updating sprite.`);
			// Only text changed: Just update the text sprite
			if (label.textSprite) {
				// Ensure previous sprite exists before removing
				label.container.remove(label.textSprite);
				label.textSprite.material.map?.dispose();
				label.textSprite.material.dispose();
				label.textSprite = null; // Nullify reference
			}
			// Use existing calculated offset
			const currentOffset = label.options.calculatedVisualOffset || this.calculateVisualOffset(mergedOptions); // Fallback offset calculation
			label.textSprite = this.createTextSprite(newText, mergedOptions);
			label.textSprite.position.copy(currentOffset); // Position using existing/calculated offset
			// label.textSprite.position.z = 0.001; // REMOVED Z-offset
			label.textSprite.visible = true; // Ensure visibility
			label.container.add(label.textSprite); // Add the new sprite
		}
		console.log(`[updateLabelText - ${id}] Update finished. Sprite:`, label.textSprite);
	}

	// Helper to get default options
	getDefaultLabelOptions() {
		return {
			width: 1.5,
			height: 0.4,
			backgroundColor: "#333333",
			textColor: "#ffffff",
			opacity: 0.8,
			showConnector: true,
			connectorPosition: "top",
			connectorWidth: 2,
			connectorLength: 0.5,
			connectorColor: "#ffffff",
			font: "Bold 24px Arial",
			padding: 10,
			depthTest: true,
			sizeAttenuation: true,
			visible: true,
			renderOrderBackground: 0,
			renderOrderText: 1,
			renderOrderConnector: -1,
			calculatedVisualOffset: new THREE.Vector3(), // Initialize
			connectorTarget: new THREE.Vector3(), // Initialize
		};
	}

	// Helper to calculate offset
	calculateVisualOffset(options) {
		// Use options directly, assuming defaults are merged in
		const width = options.width;
		const height = options.height;
		const connectorLength = options.showConnector ? options.connectorLength : 0;
		const connectorPosition = options.connectorPosition;
		const visualOffset = new THREE.Vector3();

		if (options.showConnector) {
			switch (connectorPosition) {
				case "top":
					visualOffset.y = height / 2 + connectorLength;
					break; // Above
				case "left":
					visualOffset.x = width / 2 + connectorLength;
					break; // Right
				case "right":
					visualOffset.x = -(width / 2 + connectorLength);
					break; // Left
				case "bottom":
				default:
					visualOffset.y = -(height / 2 + connectorLength);
					break; // Below
			}
		} else {
			visualOffset.y = height / 2 + 0.1; // Default slightly above
		}
		if (options.offset) {
			// Apply additional explicit offset AFTER calculating connector offset
			const explicitOffset = Array.isArray(options.offset)
				? new THREE.Vector3(...options.offset)
				: options.offset;
			visualOffset.add(explicitOffset);
		}
		return visualOffset;
	}

	// Helper to clean up label's visual elements
	cleanupLabelElements(label) {
		if (label.textSprite) {
			if (label.textSprite.parent) label.textSprite.parent.remove(label.textSprite); // Ensure removal from parent
			label.textSprite.material.map?.dispose();
			label.textSprite.material.dispose();
			label.textSprite = null;
		}
		if (label.background) {
			if (label.background.parent) label.background.parent.remove(label.background);
			label.background.material.dispose();
			label.background.geometry.dispose();
			label.background = null;
		}
		if (label.connector) {
			if (label.connector.parent) label.connector.parent.remove(label.connector);
			label.connector.material.dispose();
			label.connector.geometry.dispose();
			label.connector = null;
		}
	}

	removeLabel(id) {
		const label = this.labels.get(id);
		if (!label) return;

		this.cleanupLabelElements(label); // Use helper for cleanup
		if (label.container) {
			// Recursively dispose of children's geometries/materials if container is complex
			// For simple group, removing from parent is enough if children are handled
			if (label.container.parent) label.container.parent.remove(label.container);
		}
		this.labels.delete(id);

		if (this.callbacks.onLabelRemove) {
			this.callbacks.onLabelRemove(id);
		}
	}

	clearAllLabels() {
		const labelIds = Array.from(this.labels.keys());
		for (const id of labelIds) {
			this.removeLabel(id);
		}
	}

	setLabelVisibility(id, visible) {
		const label = this.labels.get(id);
		if (label && label.container) {
			label.container.visible = visible;
			// Optionally set children explicitly? Usually not needed if container is hidden.
			// if(label.background) label.background.visible = visible;
			// if(label.textSprite) label.textSprite.visible = visible;
			// if(label.connector) label.connector.visible = visible;
		}
	}

	updateLabelPosition(id, newPosition) {
		const label = this.labels.get(id);
		if (!label || !label.container) return;

		const finalPosition = Array.isArray(newPosition)
			? new THREE.Vector3(...newPosition)
			: newPosition.clone();
		label.container.position.copy(finalPosition);
		// Update stored target position
		if (label.options) {
			// Ensure options exist
			label.options.connectorTarget = finalPosition.clone();
		}
	}

	// --- Rendering and Update ---

	update() {
		if (!this.camera || this.labels.size === 0) return;

		const cameraQuaternion = this.camera.quaternion; // Cache for loop
		const cameraPosition = this.camera.position; // Cache camera position

		this.labels.forEach((label) => {
			if (!label.container) return; // Safety check

			// Make label face the camera (billboard effect)
			label.container.quaternion.copy(cameraQuaternion);

			// --- Optional: Distance-based effects ---
			if (label.options.fadeWithDistance) {
				const distance = label.container.position.distanceTo(cameraPosition);
				const fadeStart = label.options.fadeStartDistance || 10;
				const fadeEnd = label.options.fadeEndDistance || 30;
				const baseOpacity = label.options.opacity; // Use opacity from options

				const distanceOpacity = Math.max(0, Math.min(1, 1 - (distance - fadeStart) / (fadeEnd - fadeStart)));
				const finalOpacity = baseOpacity * distanceOpacity;

				// Apply opacity (ensure materials exist)
				if (label.background?.material) label.background.material.opacity = finalOpacity;
				// Text sprite opacity might only need distance fade, not base opacity multiplication
				if (label.textSprite?.material) label.textSprite.material.opacity = distanceOpacity;
				if (label.connector?.material) label.connector.material.opacity = finalOpacity;

				// Hide container if fully faded based on distance opacity
				label.container.visible = distanceOpacity > 0.01;
			} else {
				// Ensure container is visible if not fading
				label.container.visible = label.options.visible;
			}

			// --- Update LineMaterial Resolution (Important!) ---
			if (label.connector?.material instanceof LineMaterial) {
				const resolution = new THREE.Vector2();
				if (this.renderer) this.renderer.getDrawingBufferSize(resolution);
				else resolution.set(window.innerWidth, window.innerHeight);

				// Check if resolution actually changed to avoid unnecessary updates
				if (!label.connector.material.resolution.equals(resolution)) {
					label.connector.material.resolution.copy(resolution);
				}
			}
		});
	}

	setupViewerIntegration() {
		if (this.viewer?.update) {
			// Check if viewer and update exist
			const originalUpdate = this.viewer.update.bind(this.viewer); // Bind original update to viewer context
			const self = this; // Reference to FloatingLabels instance

			this.viewer.update = function (...args) {
				// Use rest parameters for flexibility
				originalUpdate(...args); // Call original viewer update
				self.update(); // Call labels update
			};
			console.log("FloatingLabels integrated into viewer update loop.");
		} else {
			console.warn("Viewer update loop not found for FloatingLabels integration.");
		}
	}

	show() {
		this.labelsGroup.visible = true;
	}

	hide() {
		this.labelsGroup.visible = false;
	}

	dispose() {
		this.hideEditUI(); // Ensure UI is hidden and callbacks called
		if (this.editUI?.parentNode) {
			document.body.removeChild(this.editUI);
			this.editUI = null;
		}

		// Clean up event listeners
		if (this.viewer?.renderer?.domElement && this.clickHandler) {
			this.viewer.renderer.domElement.removeEventListener("click", this.clickHandler);
		}
		this.clickHandler = null; // Remove reference

		this.clearAllLabels(); // Remove all label objects and resources
		if (this.labelsGroup) {
			if (this.labelsGroup.parent) this.labelsGroup.parent.remove(this.labelsGroup);
			this.labelsGroup = null;
		}
		this.labels.clear();

		// TODO: Restore original viewer update if needed

		this.viewer = null;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.callbacks = {}; // Clear callbacks
	}
}
