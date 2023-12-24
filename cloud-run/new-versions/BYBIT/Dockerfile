# Use an official Python runtime as a parent image
FROM python:3.11-alpine

# Set an environment variable to make Python print directly to the console
ENV PYTHONUNBUFFERED True

# Define the working directory for your application
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application's code
COPY . .

# Command to run the app
CMD exec gunicorn --bind :$PORT --worker-class uvicorn.workers.UvicornWorker --workers 1 --timeout 0 main:app
