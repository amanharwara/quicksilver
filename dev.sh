#!/bin/bash

BROWSER="${1:-"chromium"}"

./build.sh $BROWSER

PID_LIST=""

python3 -m http.server 5500 -d ./test > /dev/null 2>&1 & pid=$!
PID_LIST+=" $pid"

TEMP_PROFILE=`mktemp -d`
echo "Created temp profile for browser, $TEMP_PROFILE"

if [ $BROWSER = "firefox" ]; then
	firefox-developer-edition -profile "$TEMP_PROFILE" -no-remote -new-instance http://localhost:5500 & pid=$!
else
	chromium --user-data-dir=$TEMP_PROFILE --load-extension="./.dist/$BROWSER" http://localhost:5500 & pid=$!
fi

PID_LIST+=" $pid"

cleanup() {
	echo "Terminating processes: $PID_LIST"
	kill $PID_LIST 2>/dev/null
	wait $PID_LIST 2>/dev/null  # Ensure all processes exit before continuing

	if [ -d "$TEMP_PROFILE" ]; then
		echo "Removing temp profile $TEMP_PROFILE"
		rm -rf "$TEMP_PROFILE"
	fi
}

trap cleanup SIGINT

wait $PID_LIST
cleanup
