#!/bin/bash

BROWSER="${1:-"chromium"}"

export DIST="./.dist/${BROWSER}"

./minify-css.sh

cp manifest.json $DIST/manifest.json
cp ./src/popup.html $DIST/popup.html

if [ $BROWSER="firefox" ]; then
	cat manifest.json | jq --slurpfile f firefox.json '. + $f.[0]' > $DIST/manifest.json
fi

tsc ./src/*.ts --outDir "$DIST"

