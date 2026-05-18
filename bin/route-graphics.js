#!/usr/bin/env node

import { runRouteGraphicsCli } from "../src/cli/routeGraphicsCli.js";

const exitCode = await runRouteGraphicsCli();
process.exitCode = exitCode;
