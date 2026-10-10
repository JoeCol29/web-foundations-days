-- Create Students Table
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- Create Courses Table
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    credits INTEGER NOT NULL DEFAULT 3
);

-- Create Enrollments Table (Join Table)
-- This links students to courses and stores the grade.
-- We use a Composite Primary Key (student_id, course_id) to ensure a student 
-- can only enroll in a specific course once.
CREATE TABLE enrollments (
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Insert Sample Data: Students
INSERT INTO students (first_name, last_name, email) VALUES 
('Njomane', 'Johnson', 'njomane.j@academy.com'),
('Mokoena', 'Teboho', 'mokoena.t@academy.com'),
('Mcunu', 'Sandile', 'mcunu.s@academy.com');

-- Insert Sample Data: Courses
INSERT INTO courses (title, code, credits) VALUES 
('Intro to SQL', 'SQL101', 3),
('Web Development', 'WEB201', 4),
('Data Structures', 'CS301', 3);

-- Insert Sample Data: Enrollments (5 total)
-- Alice takes SQL and Web Dev
INSERT INTO enrollments (student_id, course_id, grade) VALUES 
(1, 1, 'A'),
(1, 2, 'B+');

-- Bob takes SQL and Data Structures
INSERT INTO enrollments (student_id, course_id, grade) VALUES 
(2, 1, 'B'),
(2, 3, 'A-');

-- Charlie takes only Web Dev
INSERT INTO enrollments (student_id, course_id, grade) VALUES 
(3, 2, 'A');

-- Queries

-- 1. All courses for one student (by name): Alice Johnson
SELECT c.title, c.code, e.grade
FROM courses c
JOIN enrollments e ON c.id = e.course_id
JOIN students s ON e.student_id = s.id
WHERE s.first_name = 'Alice' AND s.last_name = 'Johnson';

-- 2. All students on one course: Intro to SQL
SELECT s.first_name, s.last_name, s.email, e.grade
FROM students s
JOIN enrollments e ON s.id = e.student_id
JOIN courses c ON e.course_id = c.id
WHERE c.title = 'Intro to SQL';

-- 3. The number of students per course
SELECT c.title, COUNT(e.student_id) AS student_count
FROM courses c
LEFT JOIN enrollments e ON c.id = e.course_id
GROUP BY c.id, c.title;

-- 4. Students who have no enrolments
-- (In our sample data, everyone has at least one, but this query works if we added a 4th student)
SELECT s.first_name, s.last_name
FROM students s
LEFT JOIN enrollments e ON s.id = e.student_id
WHERE e.student_id IS NULL;

-- 5. An update of one enrolment's grade: Alice's SQL grade from 'A' to 'A+'
UPDATE enrollments
SET grade = 'A+'
WHERE student_id = 1 AND course_id = 1;
