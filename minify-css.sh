#!/bin/bash

#
# Minifies all the CSS files in the current directory and outputs them to the .dist folder
#

DIST="${DIST:-"./.dist"}"

if [ ! -d $DIST ]; then
	mkdir -p $DIST
fi

for file in ./*css
do
	cat $file | tr -d '\n' | sed -E 's/\s?(\{|;|:)\s+/\1/g' > $DIST/$file
done
