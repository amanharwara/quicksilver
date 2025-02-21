BROWSER="${1:-"chromium"}"
PID_LIST=""

python3 -m http.server 5500 -d ./test > /dev/null 2>&1 & pid=$!
PID_LIST+=" $pid"

if [ $BROWSER == "firefox" ]; then
    yarn dev:firefox 2>&1 & pid=$!
else
    yarn dev 2>&1 & pid=$!
fi
PID_LIST+=" $pid"

cleanup() {
	kill $PID_LIST 2>/dev/null
	wait $PID_LIST 2>/dev/null
}

trap cleanup SIGINT

wait $PID_LIST
cleanup
