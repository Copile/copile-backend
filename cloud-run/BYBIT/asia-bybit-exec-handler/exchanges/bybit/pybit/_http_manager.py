import logging
import aiohttp
import asyncio
import json
import hmac
import hashlib
from datetime import datetime as dt
import requests
from collections import defaultdict
from dataclasses import dataclass, field

from .exceptions import FailedRequestError, InvalidRequestError
from . import _helpers

# Requests will use simplejson if available.
try:
    from simplejson.errors import JSONDecodeError
except ImportError:
    from json.decoder import JSONDecodeError

HTTP_URL = "https://{SUBDOMAIN}.{DOMAIN}.com"
SUBDOMAIN_TESTNET = "api-testnet"
SUBDOMAIN_MAINNET = "api"
DOMAIN_MAIN = "bybit"
DOMAIN_ALT = "bytick"


@dataclass
class _V5HTTPManager:
    testnet: bool = field(default=False)
    domain: str = field(default="bybit")
    api_key: str = field(default=None)
    api_secret: str = field(default=None)
    logging_level: logging = field(default=logging.INFO)
    log_requests: bool = field(default=False)
    timeout: int = field(default=10)
    recv_window: bool = field(default=5000)
    force_retry: bool = field(default=False)
    retry_codes: defaultdict[dict] = field(
        default_factory=lambda: {},
        init=False,
    )
    ignore_codes: dict = field(
        default_factory=lambda: {},
        init=False,
    )
    max_retries: bool = field(default=3)
    retry_delay: bool = field(default=3)
    referral_id: bool = field(default=None)
    record_request_time: bool = field(default=False)
    return_response_headers: bool = field(default=False)

    def __post_init__(self):
        subdomain = SUBDOMAIN_TESTNET if self.testnet else SUBDOMAIN_MAINNET
        domain = DOMAIN_MAIN if not self.domain else self.domain
        url = HTTP_URL.format(SUBDOMAIN=subdomain, DOMAIN=domain)
        self.endpoint = url

        if not self.ignore_codes:
            self.ignore_codes = set()
        if not self.retry_codes:
            self.retry_codes = {10002, 10006, 30034, 30035, 130035, 130150}
        self.logger = logging.getLogger(__name__)
        if len(logging.root.handlers) == 0:
            # no handler on root logger set -> we add handler just for this logger to not mess with custom logic from outside
            handler = logging.StreamHandler()
            handler.setFormatter(
                logging.Formatter(
                    fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S",
                )
            )
            handler.setLevel(self.logging_level)
            self.logger.addHandler(handler)

        self.logger.debug("Initializing HTTP session.")

        self.client = requests.Session()
        self.client.headers.update(
            {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )
        if self.referral_id:
            self.client.headers.update({"Referer": self.referral_id})

    @staticmethod
    def prepare_payload(method, parameters):
        """
        Prepares the request payload and validates parameter value types.
        """
        def cast_values():
            string_params = [
                "qty",
                "price",
                "triggerPrice",
                "takeProfit",
                "stopLoss",
            ]
            integer_params = ["positionIdx"]
            for key, value in parameters.items():
                if key in string_params:
                    if not isinstance(value, str):
                        parameters[key] = str(value)
                elif key in integer_params:
                    if not isinstance(value, int):
                        parameters[key] = int(value)

        if method == "GET":
            payload = "&".join(
                [
                    str(k) + "=" + str(v)
                    for k, v in sorted(parameters.items())
                    if v is not None
                ]
            )
            return payload
        else:
            cast_values()
            return json.dumps(parameters)

    def _auth(self, payload, recv_window, timestamp):
        """
        Generates authentication signature per Bybit API specifications.
        """
        api_key = self.api_key
        api_secret = self.api_secret

        if api_key is None or api_secret is None:
            raise PermissionError("Authenticated endpoints require keys.")

        param_str = str(timestamp) + api_key + str(recv_window) + payload
        hash = hmac.new(
            bytes(api_secret, "utf-8"),
            param_str.encode("utf-8"),
            hashlib.sha256,
        )
        return hash.hexdigest()

    @staticmethod
    async def _verify_string(params, key):
        if key in params:
            if not isinstance(params[key], str):
                return False
            else:
                return True
        return True

    async def _submit_request(self, method=None, path=None, query=None, auth=False):
        if query is None:
            query = {}

        # Store original recv_window.
        recv_window = self.recv_window

        # Bug fix: change floating whole numbers to integers to prevent
        # auth signature errors.
        if query is not None:
            for i in query.keys():
                if isinstance(query[i], float) and query[i] == int(query[i]):
                    query[i] = int(query[i])

        # Send request and return headers with body. Retry if failed.
        retries_attempted = self.max_retries
        req_params = None

        while True:
            retries_attempted -= 1
            if retries_attempted < 0:
                raise FailedRequestError(
                    request=f"{method} {path}: {req_params}",
                    message="Bad Request. Retries exceeded maximum.",
                    status_code=400,
                    time=dt.utcnow().strftime("%H:%M:%S"),
                    resp_headers=None,
                )

            retries_remaining = f"{retries_attempted} retries remain."

            req_params = self.prepare_payload(method, query)

            # Authenticate if we are using a private endpoint.
            if auth:
                # Prepare signature.
                timestamp = _helpers.generate_timestamp()
                signature = self._auth(
                    payload=req_params,
                    recv_window=recv_window,
                    timestamp=timestamp,
                )
                headers = {
                    "Content-Type": "application/json",
                    "X-BAPI-API-KEY": self.api_key,
                    "X-BAPI-SIGN": signature,
                    "X-BAPI-SIGN-TYPE": "2",
                    "X-BAPI-TIMESTAMP": str(timestamp),
                    "X-BAPI-RECV-WINDOW": str(recv_window),
                }
            else:
                headers = {}

            # Log the request.
            if self.log_requests:
                if req_params:
                    self.logger.debug(
                        f"Request -> {method} {path}. Body: {req_params}. "
                        f"Headers: {headers}"
                    )
                else:
                    self.logger.debug(
                        f"Request -> {method} {path}. Headers: {headers}"
                    )
            async with aiohttp.ClientSession() as session:
                if method == "GET":
                    if req_params:
                        path += f"?{req_params}"
                    async with session.get(path, headers=headers) as response:
                        s = await response.text()
                else:
                    async with session.post(path, data=req_params, headers=headers) as response:
                        s = await response.text()
            # Attempt the request.
            try:
                s_json = json.loads(s)

            # If we have trouble converting, handle the error and retry.
            except JSONDecodeError as e:
                if self.force_retry:
                    self.logger.error(f"{e}. {retries_remaining}")
                    await asyncio.sleep(self.retry_delay)
                    continue
                else:
                    self.logger.debug(f"Response text: {s}")
                    raise FailedRequestError(
                        request=f"{method} {path}: {req_params}",
                        message="Conflict. Could not decode JSON.",
                        status_code=409,
                        time=dt.utcnow().strftime("%H:%M:%S"),
                        resp_headers=None,
                    )

            ret_code = "retCode"
            ret_msg = "retMsg"

            # If Bybit returns an error, raise.
            if s_json[ret_code]:
                # Generate error message.
                error_msg = f"{s_json[ret_msg]} (ErrCode: {s_json[ret_code]})"

                # Set default retry delay.
                delay_time = self.retry_delay

                # Retry non-fatal whitelisted error requests.
                if s_json[ret_code] in self.retry_codes:
                    # 10002, recv_window error; add 2.5 seconds and retry.
                    if s_json[ret_code] == 10002:
                        error_msg += ". Added 2.5 seconds to recv_window"
                        recv_window += 2500

                    # 10006, rate limit error; wait until
                    # X-Bapi-Limit-Reset-Timestamp and retry.
                    elif s_json[ret_code] == 10006:
                        self.logger.error(
                            f"{error_msg}. Hit the API rate limit. "
                            f"Sleeping, then trying again. Request: {path}"
                        )

                        # Calculate how long we need to wait in milliseconds.
                        limit_reset_time = int(response.headers["X-Bapi-Limit-Reset-Timestamp"])
                        limit_reset_str = dt.fromtimestamp(limit_reset_time / 10**3).strftime(
                            "%H:%M:%S.%f")[:-3]
                        delay_time = (int(limit_reset_time) - _helpers.generate_timestamp()) / 10**3
                        error_msg = (
                            f"API rate limit will reset at {limit_reset_str}. "
                            f"Sleeping for {int(delay_time * 10**3)} milliseconds"
                        )

                    # Log the error.
                    self.logger.error(f"{error_msg}. {retries_remaining}")
                    await asyncio.sleep(delay_time)
                    continue

                elif s_json[ret_code] in self.ignore_codes:
                    pass

                else:
                    raise InvalidRequestError(
                        request=f"{method} {path}: {req_params}",
                        message=s_json[ret_msg],
                        status_code=s_json[ret_code],
                        time=dt.utcnow().strftime("%H:%M:%S"),
                        resp_headers=None,
                    )
            else:
                if self.log_requests:
                    self.logger.debug(
                        f"Response headers: {response.headers}"
                    )

                if self.return_response_headers:
                    return s_json, None, response.headers
                elif self.record_request_time:
                    return s_json, None
                else:
                    return s_json
