#!/bin/bash

BROWSER="${1:-"chromium"}"
PARENT_DIST_DIR="./.dist" 
DIST="$PARENT_DIST_DIR/$BROWSER"

# Minify CSS
for file in ./src/*.css
do
	if [ -f $file ]; then
		cat $file | tr -d '\n' | sed -E 's/\s?(\{|;|:)\s+/\1/g' > $DIST/"${file#./src/}"
	fi
done

# Copy static code
cp manifest.json $DIST/manifest.json
cp ./src/popup.html $DIST/popup.html

# Add firefox-specific manifest config
if [ $BROWSER = "firefox" ]; then
	cat manifest.json | jq --slurpfile f firefox.json '. + $f.[0]' > $DIST/manifest.json
fi

# Compile TS files
tsc ./src/*.ts --outDir "$DIST"

ZIP="$PARENT_DIST_DIR/$BROWSER.zip" 

# Remove previous zip
if [ -f $ZIP ]; then
	rm $ZIP
fi

# Zip 
zip -j $ZIP $DIST/* > /dev/null

echo $ZIP
