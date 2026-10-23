import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const banned = ["pnpm-lock.yaml", "pnpm-workspace.yaml", ".pnpm-store"];
const found = banned.filter(name => existsSync(join(root, name)));

if (found.length > 0) {
	console.error(`This repo uses npm only. Remove accidental pnpm artifacts: ${found.join(", ")}`);
	process.exit(1);
}
