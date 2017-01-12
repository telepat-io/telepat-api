#!/usr/bin/env bash

command_exists () {
    hash "$1" &> /dev/null;
}

if command_exists "apidoc" ; then
	apidoc -i . -o documentation/ -e node_modules/
else
	echo "Unable to run script. Please install 'apidoc' npm package globally."
	exit 1
fi

exit 0
