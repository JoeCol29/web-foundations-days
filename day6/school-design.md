# School Database Design

## Table Explanations

1. **students**: Stores core demographic data for each learner. The `email` field is marked `UNIQUE` to ensure each student has a distinct contact method and to prevent duplicate accounts.
2. **courses**: Stores the catalog of available classes. The `code` field is also `UNIQUE` to allow for easy referencing (e.g., "SQL101") without needing the full title.
3. **enrollments**: This is the **join table** (or junction table) that resolves the **many-to-many** relationship between students and courses. A student can take many courses, and a course can have many students. We cannot store a list of courses inside the `students` table (or vice versa) because that would violate First Normal Form (1NF) and make querying difficult. This table also holds the `grade`, which is an attribute of the *relationship* between a student and a course, not of the student or the course individually.

## Relationships

- **Students to Enrollments**: One-to-Many. One student can have many enrollment records, but each record belongs to only one student.
- **Courses to Enrollments**: One-to-Many. One course can have many enrollment records, but each record belongs to only one course.
- **Students to Courses**: Many-to-Many. Resolved via the `enrollments` table.

## Index Recommendation

I would add an index on `enrollments(student_id)`. 

**Reason:** Queries frequently need to find all courses for a specific student (as seen in Query 1). Without an index, the database would perform a "full table scan" of the enrollments table to find matches. An index on `student_id` allows the database to jump directly to the relevant rows, significantly speeding up retrieval as the number of enrollments grows.

## SQL vs. NoSQL Decision

For this system, **SQL (Relational)** is the superior choice. The data structure is highly structured and fixed: students have names and emails, courses have titles and credits, and enrollments have grades. There is a clear, consistent relationship between these entities. SQL provides **ACID compliance** (Atomicity, Consistency, Isolation, Durability), which is critical for academic records. If a student's grade is updated, we need to be certain that change is saved consistently across the system. Additionally, the requirement to join tables to answer complex questions (like "how many students are in each course?") is a strength of SQL, whereas NoSQL databases would require more complex application-level logic to achieve the same results.
