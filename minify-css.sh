#!/bin/bash

#
# Minifies all the CSS files in the current directory and outputs them to the .dist folder
#

DIST="${DIST:-"./.dist"}"

if [ ! -d $DIST ]; then
	mkdir -p $DIST
fi

for file in ./src/*.css
do
	if [ -f $file ]; then
		cat $file | tr -d '\n' | sed -E 's/\s?(\{|;|:)\s+/\1/g' > $DIST/"${file#./src/}"
	fi
done
