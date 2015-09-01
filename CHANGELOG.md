# 0.2.1

* Added context id to kafka messages in `/object/subscribe` and `/object/create`

# 0.2.0

* New api endpoint for users to login with a password: `/user/login_password`
* Couchbase tate bucket replaced with redis database
* Fixed lots of crashes and bugs
* 404 status code is used when unsubscribing from a non existent subscription

# 0.1.5

* Application ID is verified if it exists in all requests that require it
* Standardized response of get context and get all contexts
* The npm package now requires the corect telepat-models module from the npm registry

# 0.1.4

* Added license and readme files
* Improved documentation
* `/object/subscribe` results are returned in an array instead of hash map
* API responses are more consistent
	* Success responses follow the format: `{status: 200, content: {}}`
	* Failure/error responses follow the format: `{status: 500, message: {}`

# 0.1.3

* Update operation messages now include a timestamp which is used to filter late patches affecting the same object and
property

# 0.1.2

* Updated documentation
* 200 status codes are now 202 when creating/deleting/updating objects

# 0.1.0

* Initial pre-alpha release
