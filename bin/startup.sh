#!/usr/bin/env bash

function command_exists() {
	hash "$1" &> /dev/null
}

function checkApi() {
	curl -s localhost:${PORT}
	success=$?
	printf "\n"

	if [ $success -eq 0 ]; then
		return 0
	else
		return 1
	fi
}

declare -A env_vars

index=0
PORT=""
TP_SSL=""
TP_KAFKA_HOST=""
TP_KFK_PORT=""
TP_KFK_CLIENT=""
TP_REDIS_HOST=""
TP_REDIS_PORT=""
TP_REDISCACHE=""
TP_REDISCACHE_PORT=""
TP_PW_SALT=""
TP_MAIN_DB=""
TP_ES_HOST=""
TP_ES_PORT=""
TP_AMQP_HOST=""
TP_AMQP_USER=""
TP_AMQP_PASSWORD=""

env_vars_string=""

while [ $# -gt 0 ]; do
	case "$1" in
		--i=*)
			index="${1#*=}"
		;;
		--PORT=*)
			PORT="${1#*=}"
			env_vars_string+="PORT=$PORT "
		;;
		--TP_SSL=*)
			TP_SSL="${1#*=}"
			env_vars_string+="TP_SSL=$TP_SSL "
		;;
		--TP_KAFKA_HOST=*)
			TP_KAFKA_HOST="${1#*=}"
			env_vars_string+="TP_KAFKA_HOST=$TP_KAFKA_HOST "
		;;
		--TP_KFK_PORT=*)
			TP_KFK_PORT="${1#*=}"
			env_vars_string+="TP_KFK_PORT=$TP_KFK_PORT "
		;;
		--TP_KFK_CLIENT=*)
			TP_KFK_CLIENT="${1#*=}"
			env_vars_string+="TP_KFK_CLIENT=$TP_KFK_CLIENT "
		;;
		--TP_REDIS_HOST=*)
			TP_REDIS_HOST="${1#*=}"
			env_vars_string+="TP_REDIS_HOST=$TP_REDIS_HOST "
		;;
		--TP_REDIS_PORT=*)
			TP_REDIS_PORT="${1#*=}"
			env_vars_string+="TP_REDIS_PORT=$TP_REDIS_PORT "
		;;
		--TP_REDISCACHE=*)
			TP_REDISCACHE="${1#*=}"
			env_vars_string+="TP_REDISCACHE=$TP_REDISCACHE "
		;;
		--TP_REDISCACHE_PORT=*)
			TP_REDISCACHE_PORT="${1#*=}"
			env_vars_string+="TP_REDISCACHE_PORT=$TP_REDISCACHE_PORT "
		;;
		--TP_PW_SALT=*)
			TP_PW_SALT="${1#*=}"
			env_vars_string+="TP_PW_SALT=$TP_PW_SALT "
		;;
		--TP_MAIN_DB=*)
			TP_MAIN_DB="${1#*=}"
			env_vars_string+="TP_MAIN_DB=$TP_MAIN_DB "
		;;
		--TP_ES_HOST=*)
			TP_ES_HOST="${1#*=}"
			env_vars_string+="TP_ES_HOST=$TP_ES_HOST "
		;;
		--TP_ES_PORT=*)
			TP_ES_PORT="${1#*=}"
			env_vars_string+="TP_ES_PORT=$TP_ES_PORT "
		;;
		--TP_AMQP_HOST=*)
			TP_AMQP_HOST="${1#*=}"
			env_vars_string+="TP_AMQP_HOST=$TP_AMQP_HOST "
		;;
		--TP_AMQP_USER=*)
			TP_AMQP_USER="${1#*=}"
			env_vars_string+="TP_AMQP_USER=$TP_AMQP_USER "
		;;
		--TP_AMQP_PASSWORD=*)
			TP_AMQP_PASSWORD="${1#*=}"
			env_vars_string+="TP_AMQP_PASSWORD=$TP_AMQP_PASSWORD "
	esac
	shift
done

if command_exists "forever" ; then
	if [ $PORT ]; then
		sleep 0
	else
		if [ $TP_SSL ]; then
			PORT=443
		else
			PORT=3000
		fi
	fi

	if checkApi; then
		echo "ERROR: An API is already listening on this port on this machine"
		exit 2
	fi

	if [[ $TP_SSL == "1" && $PORT -lt 1023 && "$(whoami)" != "root" ]]; then
		echo "ERROR: You must run this command as root (or with sudo)"
		exit 3
	else
		total_ram=$(cat /proc/meminfo | grep MemTotal | awk '{ print $2 }')

		if command_exists "bc"; then
			total_ram=$(printf "%d" $(bc <<< "scale=2; ${total_ram}/1024*(3/4)") 2>/dev/null)
		fi

		eval "${env_vars_string} forever start --append --uid \"api${index}\" --colors -o ./logs/api.out -e ./logs/api.err -c \"node --nouse-idle-notification --max-old-space-size=${total_ram}\" ./bin/www -i ${index}"
	fi

	echo "Waiting to boot up..."
	sleep 3

	if checkApi; then
		echo "Successfully connected to API"
	else
		echo "Could not connect to API. There may be a problem. Check forever logs in ~/.forever and ./logs/*"
		exit 1
	fi

else
	echo "Unable to run script. Please install 'forever' npm package globally."
	exit 4
fi
