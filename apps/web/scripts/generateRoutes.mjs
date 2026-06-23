/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This script regenerates the TanStack Router route tree for standalone typecheck and build steps.
*/
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Generator, getConfig } from "@tanstack/router-generator";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const config = getConfig({ target: "react", autoCodeSplitting: true }, root);
const generator = new Generator({ config, root });

await generator.run();
