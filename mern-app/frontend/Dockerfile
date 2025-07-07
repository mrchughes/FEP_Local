# ---- Build Stage ----
FROM node:18-alpine as build

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install


# Copy .env first so React build picks up environment variables
COPY .env .env
COPY . .

# Build your production-ready frontend
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine

# Copy build output to nginx's html directory
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx configuration if needed
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
