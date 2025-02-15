#!/bin/bash

# Terminate script if any command errors
set -e

BROWSER="${1:-"chromium"}"
PARENT_DIST_DIR=$(realpath "./.dist")
DIST="$PARENT_DIST_DIR/$BROWSER"

if [ ! -d $DIST ]; then
  mkdir -p $DIST
fi

# Minify CSS
for file in ./src/*.css
do
	if [ -f $file ]; then
		cat $file | tr -d '\n' | sed -E 's/\s?(\{|;|:)\s+/\1/g' > "$DIST/${file#./src/}"
	fi
done

# Copy static code
cp manifest.json $DIST/manifest.json
cp ./src/popup.html $DIST/popup.html

# Add firefox-specific manifest config
if [ $BROWSER = "firefox" ]; then
	cat manifest.json | jq --slurpfile f firefox.json '. + $f.[0]' > $DIST/manifest.json
fi

# Builds entrypoints and copies any imports into a temp file before compiling with tsc to avoid weird runtime errors regarding imports.
entrypoints=("background.ts" "content.ts")
import_regex="import .* from \"(.*)\""
curr_dir=$(pwd)
cd ./src/
for entry in ${entrypoints[@]}
do
    dist_path="$DIST/${entry}"
    if [[ -f $dist_path ]]; then
        rm $dist_path
    fi
    touch $dist_path
    while read line
    do
        if [[ $line =~ $import_regex ]]; then
            import="${BASH_REMATCH[1]}.ts"
            import_path=$(realpath $import)
            cat $import_path | sed "s/export //g" >> $dist_path
        else
            echo $line >> $dist_path
        fi
    done < $entry
    tsc $dist_path --outDir "$DIST"
    rm $dist_path
done
cd $curr_dir

if [[ $2 == "--zip" ]]; then
    ZIP="$PARENT_DIST_DIR/$BROWSER.zip"

    # Remove previous zip
    if [ -f $ZIP ]; then
    	rm $ZIP
    fi

    # Zip
    zip -j $ZIP $DIST/* > /dev/null
fi
