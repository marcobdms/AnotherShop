# Project Brief: Admin CRUD for "Another Shop"

## Objective
Design and implement a Management GUI (CRUD) to administer the product catalog. The goal is to allow an administrator to Create, Read, Update, and Delete products from the store through a visual interface.

## Project Architecture
The project is a multi-platform application (Web & iOS) with a Python-based backend.

### 1. Root Structure
- `/backend`: FastAPI application that serves the data.
- `/ios`: Native iOS application built with SwiftUI.
- `/frontend`: Web application built with React.
- `/data`: Storage for static assets and data files.
- `init.sql`: Database initialization script (if applicable).

### 2. Backend Details (`/backend`)
- `app/main.py`: Entry point for the FastAPI server. Defines the API endpoints for products, cart, and filters.
- `requirements.txt`: Python dependencies (FastAPI, Uvicorn, etc.).
- `data/catalog.json`: The **Source of Truth**. This JSON file contains the array of products. The CRUD must interact with this file or its equivalent API endpoints.

### 3. iOS Project Structure (`/ios/AnotherShop`)
- `Models/`: Data structures (Product, CartItem, Filters).
- `ViewModels/`: Logic for data fetching and state management (CatalogViewModel).
- `Services/`: Network layers (CatalogService) for API communication.
- `Views/`: SwiftUI components and screens.

### 4. Product Data Schema
A typical product in `catalog.json` follows this structure:
```json
{
  "id": 1,
  "name": "Product Name",
  "description": "Short description",
  "price": 29.99,
  "category": "Electronics",
  "image_url": "http://...",
  "stock": 15
}
```

## Requirements for the Admin GUI
1. **Product List**: A table or grid showing all products with search and filter capabilities.
2. **Editor**: A form to modify existing product details (Price, Stock, Description).
3. **Creation**: A "New Product" view with validation.
4. **Image Handling**: Ability to preview and update the `image_url`.
5. **FastAPI Integration**: The GUI should ideally communicate with new endpoints in `main.py` that handle the Persistence (writing back to `catalog.json`).

## Technical Stack Recommendation
- **Frontend for CRUD**: React (reusing the existing frontend stack) or a simple Admin Dashboard template.
- **Backend**: Extend `backend/app/main.py` with `@app.post`, `@app.put`, and `@app.delete` methods.
