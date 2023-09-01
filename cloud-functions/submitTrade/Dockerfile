# Use the official Node.js runtime as the base image
FROM node:18

# Set the working directory within the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy the function code to the container
COPY . .

# Specify the entry point for the function
CMD ["node", "index.js"]
