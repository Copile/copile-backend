# Base docker image for MetaTrader
FROM ubuntu:focal AS mt-base

ADD https://dl.winehq.org/wine-builds/winehq.key /winehq.key

# Disable interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Wine
RUN apt-get update && \
    apt-get install -y gnupg apt-utils && \
    echo "deb http://dl.winehq.org/wine-builds/ubuntu/ focal main" >> /etc/apt/sources.list && \
    apt-key add /winehq.key && \
    mv /winehq.key /usr/share/keyrings/winehq-archive.key && \
    dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y -q --install-recommends winehq-devel && \
    rm -rf /var/lib/apt/lists/* /winehq.key

# Add wine user.
# NOTE: You might need to change the UID/GID so the
# wine user has write access to your MetaTrader
# directory at $METATRADER_HOST_PATH.
RUN groupadd -g 1000 wine \
    && useradd -g wine -u 1000 wine \
    && mkdir -p /home/wine/.wine && chown -R wine:wine /home/wine

# Run MetaTrader as non privileged user.
USER wine

# Set the working directory for MetaTrader
WORKDIR /MetaTrader

# Autorun MetaTrader Terminal.
ENTRYPOINT [ "wine" ]
CMD [ "/MetaTrader/terminal64.exe", "/portable" ]

# Use an official Python runtime as a parent image
FROM python:3.11-alpine AS python-base

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
