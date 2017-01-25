#!/usr/bin/env bash

node --abort-on-uncaught-exception -r dotenv/config app.js >> debug.log
