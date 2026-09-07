#!/bin/bash
cd functions
echo "Installing dependencies..."
npm install
echo "Building functions..."
npm run build
echo "Deploying..."
firebase deploy --only functions
