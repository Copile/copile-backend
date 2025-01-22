# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Allow statements and log messages to immediately appear in the logs
ENV PYTHONUNBUFFERED True

# Define the working directory for your application
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Copy the rest of your application's code
COPY . ./

# Install production dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Run the web service on container startup using functions-framework
CMD exec functions-framework --target=handle_request --debug
