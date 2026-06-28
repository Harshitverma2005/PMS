#!/bin/bash

echo "🚀 Starting GMS Frontend..."
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✨ Starting development server..."
echo "Frontend will be available at: http://localhost:3000"
echo "Make sure backend is running at: http://localhost:8000"
echo ""

npm run dev
