#!/bin/bash

WHITE_ON_BLUE='\x1b[37;44m'
NO_COLOR='\033[0m' # No Color

# stops script if failure
stop_if_failure () {
if [ $1 -ne 0 ]; then
  echo "Failed with code $1. Exiting..."
  exit 1
fi
}

# run code formatter and linter
printf "${WHITE_ON_BLUE} Running formatter and linter...${NO_COLOR}\n"
make check-format
stop_if_failure $? # $? is the exit status of the last command

# run tests
printf "${WHITE_ON_BLUE} Running tests...${NO_COLOR}\n"
make test
stop_if_failure $? # $? is the exit status of the last command

exit 0