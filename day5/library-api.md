# Library Books API Design

Base URL: `https://api.library.example.com`

All endpoints operate on the `books` resource. Data is exchanged as JSON.

---

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns a paginated list of every book in the catalog.
- **Success status:** `200 OK`

### 2. Get a single book

- **Method:** `GET`
- **Path:** `/books/:id`
- **Description:** Returns the full record for one book by its ID.
- **Success status:** `200 OK`

### 3. Create a new book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the catalog.
- **Example request body:**

  ```json
  {
    "title": "The Pragmatic Programmer",
    "author": "David Thomas",
    "isbn": "978-0135957059",
    "year": 2019
  }

