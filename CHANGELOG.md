# 0.2.7

* Added support for loging/registering with Facebook. Register/login endpoints have changed:
	* `/user/login` is now `/user/login-facebook` and `/user/login-twitter`
	* `/user/register` is now `/user/register-facebook`, `/user/register-twitter` and `/user/register-username`
* Env variables related to logger and login providers are optional
* Added **instant** flag to admin context/user operation messages
* Logged requests now show request duration in milliseconds
* Fixed [#7](https://github.com/telepat-io/telepat-api/issues/7)
* `/object/create|delete|update|count` no longer require device ID
* `/object/create` bugfix when user is not logged in

# 0.2.6

* Changed all methods that delete resources to use DELETE HTTP method
* Fixed a bug on deathorizing admin
* Context operations also send messages to workers in order to notifiy clients
* API uses TelepatLogger instead of console.log
* `context` is not required if subscribing/unsubscribing from user or context builtin models

# 0.2.5

* Fixed `/user/update` when updating password
* Further improved the tests, now each test has an ID displayed for easy lookup. Tests should run faster.
* Variable checks for message queue client and main database
* Added pagination support for subscribe requests
* Removed `tokenValidation` in object routes because `objectACL` was already doing that
* `/object/count` should now work
* Applications loaded on boot up are saved in Application object from telepat-models
* Fixed some minor bugs

# 0.2.4

* Implemented /admin/authorize and /admin/deauthorize to add/remove admins to an application
* Replaced "manual" patch forming with Delta.formPatch
* Updated code to use Messaging Client instead of directly kafka
* Updated code to use the TelepatError class for API errors
* Improved input validation and documentation

# 0.2.3

* Replaced couchbase with elasticsearch through adapters
* Implemented mocha tests, added istanbul code coverage and integrated with travis CI
* Lots of bug fixes
* All update endpoints require patches
* Admin routes are separated in more than 1 file
* Passwords are stored using bcrypt
* There's only one configuration file in the root folder. The example provided should be used. The original config file
was added to .gitignore

# 0.2.2

* Fixed lots of bugs and server crashes
* User info is returned on login calls (user & admin)
* Separated user login and user register endpoints
* Admin endpoint for deleting users sends messages to aggregator to delete objects (1 message per object removed)
* Standardized /admin endpoints responses
* Each patch from /object/update is sent in 1 message to the aggregator
* Standardized and fixed lots of inconsistencies in HTTP status codes in responses
* Added more input validation, especially to /admin routes
* `/user/logout`, `/user/refresh_token` uses GET method
* Devices with no device ID should use the string `TP_EMPTY_UDID` in the `X-BLGREQ-UDID` header when registering

# 0.2.1

* Added context id to kafka messages in `/object/subscribe` and `/object/create`

# 0.2.0

* New api endpoint for users to login with a password: `/user/login_password`
* Couchbase bucket replaced with redis database
* Fixed lots of crashes and bugs
* 404 status code is used when unsubscribing from a non existent subscription

# 0.1.5

* Application ID is verified if it exists in all requests that require it
* Standardized response of get context and get all contexts
* The npm package now requires the correct telepat-models module from the npm registry

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
