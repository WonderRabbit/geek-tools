#!/usr/bin/env node
"use strict";

const { JSON_FLAGS, runEstimateCommand } = require("./wonder_estimate_cli.js");
runEstimateCommand("review", JSON_FLAGS);
