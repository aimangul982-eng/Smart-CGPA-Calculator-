# Smart CGPA Calculator
**Calculate • Track • Improve**

A BS Information Technology project: GPA/CGPA calculator with a Node.js + Express REST API and SQLite database.

## Run
1. Install Node.js 18 or newer.
2. In this folder run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000

The SQLite database file `cgpa.db` is created automatically on first start.

## Project structure
```
server.js          Express server, REST API, SQLite setup
public/index.html  User interface
public/style.css   Styling (responsive)
public/app.js      Validation, GPA/CGPA calculation, API calls
```

## REST API
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/results | Save a result |
| GET | /api/results?search= | List / search results |
| GET | /api/results/:id | Get one result |
| DELETE | /api/results/:id | Delete a result |

## Formulas
- GPA = Σ(Credit Hours × Grade Points) / Σ Credit Hours
- CGPA = (Prev CGPA × Prev CH + GPA × Current CH) / (Prev CH + Current CH)
- No previous semester → CGPA = GPA
