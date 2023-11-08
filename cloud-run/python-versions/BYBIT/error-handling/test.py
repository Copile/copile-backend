import api_error as ae

ae.ApiError.load_error_messages()

print(ae.ApiError.error_messages)