#!/bin/bash

# need to install lsof
# sudo apt install lsof

# Prompt for the port number
read -r -p "Enter the port number to kill: " port

# Find all PIDs using the given port numbero
found=0
for pid in $(lsof -t -i:"$port"); do
    echo "Killing process with PID $pid that is using port $port..."
    kill -9 "$pid"
    found=1
done

# Check if any processes were found and killed
if [ $found -eq 0 ]; then
    echo "No processes found using port $port."
else
    echo "All processes using port $port have been killed."
fi

# Pause for user to see the output (useful for scripts run interactively)
read -r -p "Press Enter to continue..."