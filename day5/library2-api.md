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

Success status: 201 Created

### 4. Update an existing book

- **Method:** `PUT`
- **Path:** `/books/:id`
- **Description:** Replaces the entire record of an existing book. All fields must be provided.
- **Example request body:**

{
  "title": "The Pragmatic Programmer (20th Anniversary Edition)",
  "author": "David Thomas",
  "isbn": "978-0135957059",
  "year": 2019
}

Success status: 200 OK

### 5. Partially update a book
- **Method:** `PATCH`
- **Path:** `/books/:id`
- **Description:** Updates only the fields provided in the request body, leaving all other fields unchanged. This differs from PUT because PUT requires the entire resource to be resent, while PATCH lets you send only what changed.
- **Example request body:**

{
  "year": 2020
}
Success status: 200 OK

### 6. Delete a book
- **Method:** `DELETE`
- **Path:** `/books/:id`
- **Description:** Permanently removes a book from the catalog.

Success status: 204 No Content

### 7. List books by author
- **Method:** `GET`
- **Path:** `/books?author=David+Thomas`
- **Description:** Filters the book list using a query parameter.

Success status: 200 OK

## Error Codes
400 Bad Request
Returned when the client sends malformed or incomplete data.

Example: A POST /books request missing the required title field.

{
  "error": "Validation failed",
  "details": "Field 'title' is required."
}
404 Not Found
Returned when the requested resource does not exist

Example: GET /books/9999 where no book has ID 9999.


{
  "error": "Not Found",
  "details": "No book exists with ID 9999."
}
