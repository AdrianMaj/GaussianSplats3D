// rollup.config.js
import { base64 } from "./util/import-base-64.js";
import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve"; // <--- Import

// Keep only 'three' external, the line modules will be bundled
const externalDeps = ["three"];

// Only map 'three' for UMD
const globals = {
	three: "THREE",
};

export default [
	// UMD Build
	{
		input: "./src/index.js",
		treeshake: false,
		external: externalDeps, // <--- Use updated external array
		output: [
			{
				name: "Gaussian Splats 3D",
				extend: true,
				format: "umd",
				file: "./build/gaussian-splats-3d.umd.cjs",
				globals: globals, // <--- Use updated globals
				sourcemap: true,
			},
			{
				name: "Gaussian Splats 3D",
				extend: true,
				format: "umd",
				file: "./build/gaussian-splats-3d.umd.min.cjs",
				globals: globals, // <--- Use updated globals
				sourcemap: true,
				plugins: [terser()],
			},
		],
		plugins: [
			nodeResolve(), // <--- Add resolver plugin
			base64({ include: "**/*.wasm" }),
		],
	},
	// ESM Build
	{
		input: "./src/index.js",
		treeshake: false,
		external: externalDeps, // <--- Use updated external array
		output: [
			{
				name: "Gaussian Splats 3D",
				format: "esm",
				file: "./build/gaussian-splats-3d.module.js",
				sourcemap: true,
			},
			{
				name: "Gaussian Splats 3D",
				format: "esm",
				file: "./build/gaussian-splats-3d.module.min.js",
				sourcemap: true,
				plugins: [terser()],
			},
		],
		plugins: [
			nodeResolve(), // <--- Add resolver plugin
			base64({
				include: "**/*.wasm",
				sourceMap: false,
			}),
		],
	},
];
